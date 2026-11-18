// src/app/api/deep-analysis/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { question, userContext, historicalData } = await req.json();

    // ✅ 1. Vérification de la clé API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/deep-analysis] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, une intelligence personnelle experte en performance sportive, santé et nutrition.
    Tu as accès à l'historique complet de l'utilisateur (14 derniers jours).
    
    Ta mission : Analyser les corrélations entre les données pour répondre à la question de l'utilisateur ou pour expliquer une anomalie détectée.
    
    RÈGLES :
    1. Sois factuel : base-toi UNIQUEMENT sur les données fournies.
    2. Sois explicatif : ne te contente pas de dire "tu es fatigué", explique "pourquoi" (ex: corrélation entre baisse de sommeil et hausse de charge).
    3. Sois concis : 3 à 4 phrases maximum.
    4. Si tu ne trouves pas de corrélation évidente, dis-le.

    Contexte global : ${userContext || "Aucune information"}
    Historique détaillé (14 jours) : ${historicalData || "Aucune donnée"}
    
    Question / Anomalie à analyser : "${question}"`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.5,
        max_tokens: 400,
      }),
    });

    const data = await response.json();

    // ✅ 2. Vérification de l'erreur Groq
    if (!response.ok) {
      console.error("❌ [api/deep-analysis] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" }, 
        { status: 502 }
      );
    }

    // ✅ 3. Protection contre les réponses malformées
    const analysis = data?.choices?.[0]?.message?.content;
    if (!analysis) {
      console.error("❌ [api/deep-analysis] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    return NextResponse.json({ analysis });

  } catch (error) {
    // ✅ 4. Log de l'exception
    console.error("❌ [api/deep-analysis] Exception:", error);
    return NextResponse.json(
      { error: "Erreur d'analyse", detail: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
}