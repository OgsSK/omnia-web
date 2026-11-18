// src/app/api/goals-suggestion/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userContext, goals, recentData, requestType } = await req.json();

    // ✅ 1. Vérification de la clé API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/goals-suggestion] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    // On adapte le prompt selon ce que le client demande
    const isSuggestion = requestType === "suggestion" || !requestType;

    const systemPrompt = `Tu es OMNIA, un coach sportif d'élite.
    Tu dois analyser les objectifs de l'utilisateur et ses données récentes.
    
    Contexte utilisateur : ${userContext || "Aucun"}
    Objectifs actuels : ${JSON.stringify(goals || [])}
    Données récentes (tests, poids, etc.) : ${JSON.stringify(recentData || [])}
    
    Ta mission :
    ${isSuggestion 
      ? `Propose exactement 3 nouveaux objectifs pertinents et réalistes basés sur ses dernières performances.
         Format de réponse JSON STRICT attendu : 
         { "suggestions": [ { "title": "Nom de l'objectif", "target": 10, "unit": "kg", "metric_type": "weight", "direction": "lower_is_better" } ] }`
      : `Analyse l'objectif ciblé et donne un conseil court (2 phrases max).
         Format de réponse JSON STRICT attendu : 
         { "analysis": "Ton conseil ici" }`
    }
    Ne renvoie rien d'autre que du JSON valide.`;

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
        response_format: { type: "json_object" }, // Force le JSON
      }),
    });

    const data = await response.json();

    // ✅ 2. Vérification de l'erreur Groq
    if (!response.ok) {
      console.error("❌ [api/goals-suggestion] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" }, 
        { status: 502 }
      );
    }

    // ✅ 3. Parsing de la réponse JSON de l'IA
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("❌ [api/goals-suggestion] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error("❌ [api/goals-suggestion] Impossible de parser le JSON de l'IA:", content);
      return NextResponse.json({ error: "L'IA a renvoyé un format invalide" }, { status: 502 });
    }

    // ✅ 4. Renvoi adapté selon ce qui a été demandé
    if (isSuggestion) {
      return NextResponse.json({ suggestions: parsedContent.suggestions || [] });
    } else {
      return NextResponse.json({ analysis: parsedContent.analysis || "Aucun conseil généré." });
    }

  } catch (error) {
    console.error("❌ [api/goals-suggestion] Exception:", error);
    return NextResponse.json(
      { error: "Erreur d'analyse", detail: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
}