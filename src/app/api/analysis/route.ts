// src/app/api/analysis/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { context } = await req.json();

    // ✅ 1. Vérification de la clé API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("[api/analysis] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, une intelligence personnelle experte en performance sportive et en récupération.
    L'utilisateur te demande un bilan complet. Tu as accès à ses données des dernières semaines.
    Rédige une analyse structurée en 3 parties :
    1. **État actuel** : Ce qui va bien, les points forts.
    2. **Points d'attention** : Ce qui peut être amélioré (fatigue, baisse de performance, etc.).
    3. **Recommandations** : 2 à 3 actions concrètes à mettre en place pour les prochains jours.
    Sois professionnel, direct, et utilise des sauts de ligne pour aérer le texte. Ne fais pas de diagnostic médical.

    Voici les données complètes de l'utilisateur :
    ${context || "Aucune donnée fournie."}`;

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
          { role: "user", content: "Génère mon bilan complet." }
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    // ✅ 2. Vérification de la réponse HTTP de Groq
    if (!response.ok) {
      console.error("[api/analysis] Erreur Groq:", response.status, data);
      return NextResponse.json(
        { error: `Groq a renvoyé une erreur ${response.status}`, detail: data?.error?.message ?? "inconnue" },
        { status: 502 }
      );
    }

    // ✅ 3. Vérification de la structure de la réponse
    const analysis = data?.choices?.[0]?.message?.content;
    if (!analysis) {
      console.error("[api/analysis] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    return NextResponse.json({ analysis });

  } catch (error) {
    // ✅ 4. Log de l'erreur pour la voir dans le terminal
    console.error("[api/analysis] Exception:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}