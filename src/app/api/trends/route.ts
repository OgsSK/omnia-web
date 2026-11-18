// src/app/api/trends/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { metrics, tests, nutrition, journal } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/trends] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, un coach sportif d'élite.
    Tu analyses les données récentes de l'athlète pour trouver des corrélations entre son sommeil, son entraînement, sa nutrition et son humeur.

    ⚠️ RÈGLES DE RÉPONSE ABSOLUES (TRÈS IMPORTANT) :
    1. Sois extrêmement concis : 3 à 4 phrases MAXIMUM.
    2. Utilise un ton de coach direct et encourageant, PAS de statisticien.
    3. INTERDICTION FORMELLE d'utiliser des tableaux, du code, du JSON ou des listes à puces complexes. Écris un texte fluide.
    4. Si tu n'as pas assez de données pour trouver une vraie corrélation (ex: moins de 3 jours de données croisées), réponds EXACTEMENT ceci : "J'ai besoin de quelques jours de données supplémentaires pour identifier des tendances fiables. Continue à enregistrer tes entraînements, ton sommeil et tes repas, et je te sortirai une analyse croisée sur mesure !" Ne donne AUCUN conseil de collecte de données.

    Données Sommeil/Récupération : ${JSON.stringify(metrics || [])}
    Données Tests Physiques : ${JSON.stringify(tests || [])}
    Données Nutrition (Calories) : ${JSON.stringify(nutrition || [])}
    Données Journal (Humeur) : ${JSON.stringify(journal || [])}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // ✅ Modèle mis à jour
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.5,
        max_tokens: 300,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ [api/trends] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" },
        { status: 502 }
      );
    }

    const analysis = data?.choices?.[0]?.message?.content;
    if (!analysis) {
      console.error("❌ [api/trends] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error("❌ [api/trends] Exception:", error);
    return NextResponse.json(
      { error: "Erreur d'analyse", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}