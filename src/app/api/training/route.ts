// src/app/api/training/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { context } = await req.json();

    // ✅ 1. Vérification de la clé API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/training] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, un préparateur physique d'élite, kinésithérapeute et nutritionniste.
    Ta mission est de créer une séance d'entraînement 100% sécurisée et adaptée à l'état actuel de l'athlète.
    
    ⚠️ RÈGLES STRICTES :
    1. Si l'athlète a des blessures actives, tu DOIS exclure les exercices sollicitant ces zones et proposer des alternatives (ex: si mal au genou, proposer du développé couché au lieu du squat).
    2. Si la récupération est < 50%, réduis l'intensité (RPE max 6) et privilégie la mobilité ou la technique.
    3. Si le stress est élevé, évite les exercices trop explosifs qui stimulent le système nerveux.
    4. Adapte la séance au niveau d'énergie et aux calories consommées.

    Voici le contexte de l'athlète : ${context || "Aucune information"}
    
    Tu DOIS répondre STRICTEMENT sous ce format JSON :
    {
      "title": "Nom de la séance",
      "description": "Explication de pourquoi cette séance est adaptée (mentionne les blessures évitées, la fatigue, etc.).",
      "exercises": [
        { 
          "name": "Nom de l'exercice", 
          "details": "3 séries de 10 reps",
          "rest": "60 secondes",
          "rpe": 7,
          "note": "Conseil technique ou substitution"
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
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();

    // ✅ 2. Vérification de l'erreur Groq
    if (!response.ok) {
      console.error("❌ [api/training] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" },
        { status: 502 }
      );
    }

    // ✅ 3. Parsing sécurisé du JSON
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("❌ [api/training] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    let workout;
    try {
      workout = JSON.parse(content);
    } catch (parseError) {
      console.error("❌ [api/training] Impossible de parser le JSON de l'IA:", content);
      return NextResponse.json({ error: "L'IA a renvoyé un format invalide" }, { status: 502 });
    }

    return NextResponse.json({ workout });

  } catch (error) {
    // ✅ 4. Log de l'exception
    console.error("❌ [api/training] Exception:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}