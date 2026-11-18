// src/app/api/optimize-meal/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { dishName, userContext } = await req.json();

    if (!dishName || typeof dishName !== "string" || dishName.trim().length < 2) {
      return NextResponse.json({ error: "Nom de plat invalide" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/optimize-meal] GROQ_API_KEY manquante");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, un chef nutritionniste sportif d'élite.

L'utilisateur souhaite manger : "${dishName.trim()}".
${userContext ? `Contexte physiologique : ${userContext}.` : ""}

⚠️ RÈGLES CRITIQUES :

1. CORRECTION AUTOMATIQUE : Si l'utilisateur a fait une faute de frappe ou mal orthographié le plat
   (ex: "tiramisou" → "tiramisu", "burguer" → "burger", "pizza margarita" → "pizza margherita"),
   tu DOIS deviner le plat réel et le traiter comme tel. Ne refuse JAMAIS à cause d'une faute.

2. Si le nom est vraiment incompréhensible (charabia du genre "asdfgh"), retourne UNIQUEMENT :
   { "error": "Je n'ai pas reconnu ce plat. Peux-tu préciser ?" }

3. Propose EXACTEMENT 3 versions du plat :

   - Version A — "classique" : la recette originale de référence (pour comparaison).
   - Version B — "allegee" : version optimisée, moins calorique (-20 à -40%),
     en gardant le goût et la satiété (ex: moins de sucre, moins de gras, plus de légumes).
   - Version C — "proteinee" : version optimisée pour un sportif,
     plus de protéines (≥ 25g), idéale en post-entraînement.

4. Pour chaque version, fournis :
   - name : nom du plat avec l'adjectif (ex: "Tiramisu allégé au skyr")
   - description : 1 phrase expliquant POURQUOI cette version est meilleure (nutritionnellement)
   - ingredients : liste d'ingrédients avec unités NATURELLES
     • Aliments comptables (œufs, bananes, biscuits…) → "unit"
     • Vrac (sucre, farine, cacao, fromage…) → "g"
     • Liquides → "ml"
     • Condiments (extrait de vanille, sel…) → "c.à.c" ou "c.à.s" ou "pincée"
   - instructions : un tableau de 3 à 5 étapes courtes pour préparer le plat (ex: ["Préchauffer le four à 180°C.", "Mélanger le skyr avec le cacao."])
   - calories (kcal), protein (g), carbs (g), fat (g) — valeurs réalistes par portion
   - healthScore : note de 1 à 10 (10 = super sain)

5. Réponds STRICTEMENT en JSON valide :
{
  "originalDish": "Nom corrigé du plat",
  "correctionNote": "Phrase courte si tu as corrigé une faute, sinon null",
  "options": [
    {
      "name": "Nom version",
      "variant": "classique" | "allegee" | "proteinee",
      "description": "Pourquoi c'est mieux",
      "ingredients": [{ "name": "Ingrédient", "amount": 100, "unit": "g" }],
      "instructions": ["Étape 1", "Étape 2", "Étape 3"],
      "calories": 350,
      "protein": 20,
      "carbs": 40,
      "fat": 12,
      "healthScore": 7
    }
  ]
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
          { role: "user", content: `Optimise ce plat : ${dishName.trim()}` },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ [api/optimize-meal] Erreur Groq:", response.status, JSON.stringify(data));
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
      console.error("❌ [api/optimize-meal] JSON invalide:", content);
      return NextResponse.json({ error: "Format invalide" }, { status: 502 });
    }

    if (reply.error) {
      return NextResponse.json({ error: reply.error }, { status: 422 });
    }

    if (!Array.isArray(reply.options) || reply.options.length === 0) {
      console.error("❌ [api/optimize-meal] Pas d'options:", reply);
      return NextResponse.json({ error: "Aucune suggestion générée" }, { status: 502 });
    }

    return NextResponse.json({
      originalDish: reply.originalDish || dishName,
      correctionNote: reply.correctionNote || null,
      options: reply.options,
    });

  } catch (error) {
    console.error("❌ [api/optimize-meal] Exception:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'optimisation.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}