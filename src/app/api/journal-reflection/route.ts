// src/app/api/journal-reflection/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { content, mood, recentContext } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Contenu manquant" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("[journal-reflection] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const moodLabels: Record<number, string> = {
      1: "Très mal / Épuisé",
      2: "Fatigué / Stressé",
      3: "Neutre",
      4: "Bien / Motivé",
      5: "Excellent / En feu"
    };

    const systemPrompt = `Tu es OMNIA, un coach mental et psychologue du sport d'élite.
    L'utilisateur vient d'écrire une note dans son journal.
    
    Son humeur déclarée : ${mood}/5 (${moodLabels[mood] || "Non précisée"}).
    Contexte récent de l'athlète : ${recentContext || "Pas de données"}.
    Note de l'utilisateur : "${content}".
    
    Ta mission :
    Réponds-lui de manière empathique, professionnelle et concise (2 à 3 phrases maximum).
    1. Valide son ressenti (fais-lui savoir que tu l'as compris).
    2. Fais un lien avec ses données sportives si c'est pertinent.
    3. Donne-lui un micro-conseil mental ou physique.
    Ne sois pas robotique. Sois un mentor.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[journal-reflection] Groq HTTP error:", response.status, data);
      return NextResponse.json(
        { error: `Groq ${response.status}`, detail: data?.error?.message ?? "inconnu" },
        { status: 502 }
      );
    }

    const reflection = data?.choices?.[0]?.message?.content;
    if (!reflection) {
      console.error("[journal-reflection] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "Réponse IA vide" }, { status: 502 });
    }

    return NextResponse.json({ reflection });

  } catch (error) {
    console.error("[journal-reflection] Exception:", error);
    return NextResponse.json(
      { error: "Erreur d'analyse", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}