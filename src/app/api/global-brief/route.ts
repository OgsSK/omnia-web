// src/app/api/global-brief/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { metrics, measurements, nutrition, injuries, journal } = await req.json();

    // ✅ 1. Vérification de la clé API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/global-brief] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, le cerveau central d'un athlète.
    Tu dois générer un "Bilan de Forme Global" pour la semaine écoulée.
    
    Voici les données des 7 derniers jours :
    - Sommeil/Récupération : ${JSON.stringify(metrics || [])}
    - Derniers Tests physiques : ${JSON.stringify(measurements || [])}
    - Nutrition (Calories consommées) : ${JSON.stringify(nutrition || [])}
    - Blessures actives : ${JSON.stringify(injuries || [])}
    - Dernières notes de journal (humeur) : ${JSON.stringify(journal || [])}
    
    Ta mission :
    Rédige un bilan structuré en 3 parties :
    1. **État Global** : Ce qui va bien (points forts).
    2. **Analyse Croisée** : Le lien entre les données (ex: "Ta récupération baisse car ton sommeil est < 6h et ta charge a augmenté"). Mentionne les blessures si présentes.
    3. **Recommandation du Jour** : UNE action concrète prioritaire pour aujourd'hui.
    
    Sois concis, professionnel et direct. 3 à 4 phrases par partie maximum.`;

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
          { role: "user", content: "Génère mon bilan." }
        ],
        temperature: 0.6,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    // ✅ 2. Vérification de l'erreur Groq
    if (!response.ok) {
      console.error("❌ [api/global-brief] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" }, 
        { status: 502 }
      );
    }

    // ✅ 3. Protection contre les réponses malformées
    const brief = data?.choices?.[0]?.message?.content;
    if (!brief) {
      console.error("❌ [api/global-brief] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    return NextResponse.json({ brief });

  } catch (error) {
    // ✅ 4. Log de l'exception
    console.error("❌ [api/global-brief] Exception:", error);
    return NextResponse.json(
      { error: "Erreur d'analyse", detail: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
}