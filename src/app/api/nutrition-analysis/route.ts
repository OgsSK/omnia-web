// src/app/api/nutrition-analysis/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { meals, targetCals, targetProtein, weightGoal, userContext } = await req.json();

    // ✅ 1. Vérification de la clé API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/nutrition-analysis] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, un coach en nutrition sportive d'élite.
    Analyse la journée alimentaire de l'utilisateur.
    
    CONTEXTE :
    - Objectif : ${weightGoal === 'lose' ? 'Perte de poids' : weightGoal === 'gain' ? 'Prise de masse' : 'Maintien'}.
    - Calories cibles : ${targetCals} kcal.
    - Protéines cibles : ${targetProtein}g.
    - Contexte physiologique : ${userContext || "Aucune info"}
    
    REPAS DE LA JOURNÉE :
    ${JSON.stringify(meals || [])}
    
    Ta mission :
    Fais un bilan rapide en 3 points :
    1. **Bilan Calorique** : Est-ce trop, pas assez ou parfait ?
    2. **Qualité des Macros** : Les protéines sont-elles suffisantes pour l'objectif ?
    3. **Conseil** : UNE action concrète pour le prochain repas ou demain.
    
    Sois direct, professionnel, max 3 phrases.`;

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
          { role: "user", content: "Génère mon bilan nutritionnel." }
        ],
        temperature: 0.6,
        max_tokens: 250,
      }),
    });

    const data = await response.json();

    // ✅ 2. Vérification de l'erreur Groq
    if (!response.ok) {
      console.error("❌ [api/nutrition-analysis] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" }, 
        { status: 502 }
      );
    }

    // ✅ 3. Protection contre les réponses malformées
    const analysis = data?.choices?.[0]?.message?.content;
    if (!analysis) {
      console.error("❌ [api/nutrition-analysis] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    return NextResponse.json({ analysis });

  } catch (error) {
    // ✅ 4. Log de l'exception
    console.error("❌ [api/nutrition-analysis] Exception:", error);
    return NextResponse.json(
      { error: "Erreur d'analyse", detail: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
}