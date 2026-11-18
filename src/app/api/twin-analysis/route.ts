// src/app/api/twin-analysis/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { scores, worstPillar, userName } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/twin-analysis] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, un coach personnel d'élite.
    Tu analyses le "Jumeau Personnel" de l'utilisateur.
    
    Voici ses scores sur 6 piliers (sur 100) :
    - Physique : ${scores?.physique ?? 0}
    - Récupération : ${scores?.recuperation ?? 0}
    - Mental : ${scores?.mental ?? 0}
    - Régularité : ${scores?.regularite ?? 0}
    - Nutrition : ${scores?.nutrition ?? 0}
    - Objectifs : ${scores?.objectifs ?? 0}
    
    Son point faible actuel est : ${worstPillar || "Non défini"}.
    
    Ta mission :
    Génère un PLAN D'ACTION PERSONNALISÉ pour les 30 prochains jours.
    Structure ta réponse avec ces titres exacts : SEMAINE 1, SEMAINE 2-3, SEMAINE 4.
    Chaque étape doit contenir 2 actions précises liées à son point faible.
    
    ⚠️ RÈGLES DE FORMAT STRICTES :
    1. Utilise le VOUVOIEMENT (pas de "tu", pas de "ton").
    2. Sois encourageant et professionnel.
    3. N'utilise PAS de tableaux.
    4. Termine par une phrase de motivation.

    Format attendu :
    **SEMAINE 1 : [Titre]**
    - Action 1
    - Action 2

    **SEMAINE 2-3 : [Titre]**
    - Action 1
    - Action 2

    **SEMAINE 4 : [Titre]**
    - Action 1
    - Action 2
    
    **MOTIVATION : [Courte phrase de motivation]**`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // ✅ Le nouveau modèle
        messages: [
          { role: "system", content: systemPrompt }, 
          { role: "user", content: "Génère mon plan d'action." }
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ [api/twin-analysis] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" },
        { status: 502 }
      );
    }

    const plan = data?.choices?.[0]?.message?.content;
    if (!plan) {
      console.error("❌ [api/twin-analysis] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    return NextResponse.json({ plan });

  } catch (error) {
    console.error("❌ [api/twin-analysis] Exception:", error);
    return NextResponse.json(
      { error: "Erreur d'analyse", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}