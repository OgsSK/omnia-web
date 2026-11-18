// src/app/api/substitute-exercise/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { workout, exercise, constraints, userPreference } = await req.json();

    if (!exercise || !exercise.name) {
      return NextResponse.json({ error: "Exercice manquant" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/substitute-exercise] GROQ_API_KEY manquante");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const c = constraints || {};

    // Résumé des autres exercices pour éviter les doublons
    const otherExercises = (workout?.exercises || [])
      .filter((ex: any) => ex.name !== exercise.name)
      .map((ex: any) => `${ex.name} (${ex.details})`)
      .join(", ") || "aucun autre";

    const injuriesText = (c.injuries || [])
      .map((i: any) => `${i.body_part} (intensité ${i.severity}/5)`)
      .join(", ") || "aucune blessure active";

    const systemPrompt = `Tu es OMNIA, un préparateur physique d'élite, kinésithérapeute et nutritionniste.

⚠️ L'utilisateur veut REMPLACER un exercice de sa séance en cours.
Tu dois proposer 3 alternatives qui respectent ABSOLUMENT TOUTES les contraintes ci-dessous. Aucune exception.

=== CONTRAINTES DE L'ATHLÈTE (INVIOLABLES) ===
- ⚠️ BLESSURES ACTIVES : ${injuriesText}
  → Tu DOIS exclure tout exercice qui solliciterait ces zones.
- RÉCUPÉRATION DU JOUR : ${c.recoveryScore ?? 100}% / 100
  → Si < 50%, RPE max 6, privilégie la technique et la mobilité.
- NIVEAU DE STRESS : ${c.stress ?? 3}/5
  → Si ≥ 4, évite les exercices explosifs (plio, sprints maximaux).
- MATÉRIEL DISPONIBLE : ${c.equipment || "non précisé"}
  → Tu DOIS utiliser UNIQUEMENT ce matériel.
- LIEU : ${c.location || "non précisé"}
  → Pas de machines si "Maison" ou "Extérieur".
- DURÉE TOTALE DE LA SÉANCE : ${c.duration || "non précisée"}
  → Le substitut ne doit pas rallonger de façon déraisonnable.
- FOCUS DE LA SÉANCE : ${c.focus || "Full body"}
  → Le substitut doit rester dans le focus prévu.
- OBJECTIF : ${c.weightGoal === "lose" ? "Sèche (circuit, peu de repos)" : c.weightGoal === "gain" ? "Prise de masse (force, hypertrophie)" : "Maintien"}

=== SÉANCE ACTUELLE ===
Titre : ${workout?.title || "Séance"}
Autres exercices déjà présents (à ne pas dupliquer) : ${otherExercises}

=== EXERCICE À REMPLACER ===
- ${exercise.name}
- Détails : ${exercise.details || "-"}
- RPE : ${exercise.rpe ?? "-"}
- Repos : ${exercise.rest || "-"}
- Note actuelle : ${exercise.note || "-"}

${userPreference ? `=== PRÉFÉRENCE UTILISATEUR ===\n"${userPreference}"\n(Le substitut DOIT respecter cette préférence SI elle est compatible avec les contraintes. Sinon, explique pourquoi dans le champ reason.)` : ""}

=== TA MISSION ===
Propose EXACTEMENT 3 exercices de substitution viables.

Pour chacun :
- Le nom de l'exercice
- Les détails (séries × reps, ou durée)
- Le repos
- Le RPE cible (respecte la limite imposée par la récupération)
- Un "note" (conseil technique court)
- Un "reason" (1 phrase expliquant POURQUOI cette alternative respecte les contraintes)

⚠️ Si AUCUNE alternative n'est possible à cause des contraintes (ex: focus bas du corps + genou blessé + pas de matériel), retourne :
{ "substitutes": [], "warning": "Explication courte" }

⚠️ Réponds STRICTEMENT en JSON valide :
{
  "substitutes": [
    {
      "name": "Nom du substitut",
      "details": "3 séries de 12 reps",
      "rest": "60 secondes",
      "rpe": 6,
      "note": "Conseil technique",
      "reason": "Ne sollicite pas le genou blessé, compatible avec haltères."
    }
  ],
  "warning": null
}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Propose 3 alternatives pour "${exercise.name}".` },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ [api/substitute-exercise] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" },
        { status: 502 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    let reply;
    try {
      reply = JSON.parse(content);
    } catch {
      console.error("❌ [api/substitute-exercise] JSON invalide:", content);
      return NextResponse.json({ error: "Format invalide" }, { status: 502 });
    }

    const substitutes = Array.isArray(reply.substitutes) ? reply.substitutes : [];

    if (substitutes.length === 0) {
      return NextResponse.json({
        substitutes: [],
        warning: reply.warning || "Aucune alternative viable avec les contraintes actuelles.",
      });
    }

    return NextResponse.json({
      substitutes,
      warning: reply.warning || null,
    });

  } catch (error) {
    console.error("❌ [api/substitute-exercise] Exception:", error);
    return NextResponse.json(
      { error: "Erreur lors de la substitution.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}