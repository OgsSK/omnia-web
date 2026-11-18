// src/app/api/briefing/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { recoveryScore, sleepHours, fatigueLevel, lastSprint } = await req.json();

    // ✅ Vérification de la clé API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("[api/briefing] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ 
        briefing: "Concentrez-vous sur votre récupération aujourd'hui. Un entraînement léger est recommandé." 
      });
    }

    let context = `L'utilisateur a un score de récupération de ${recoveryScore}%. `;
    if (sleepHours) context += `Il a dormi ${sleepHours} heures. `;
    if (fatigueLevel) context += `Son niveau de fatigue est de ${fatigueLevel}/5. `;
    if (lastSprint) context += `Son dernier sprint 20m est de ${lastSprint}s. `;

    const systemPrompt = `Tu es OMNIA, une intelligence personnelle experte en performance sportive.
    Tu dois générer un "Briefing Matinal" très court (maximum 2 phrases), direct et motivant.
    Analyse les données suivantes et donne un conseil concret pour la journée.
    Ne fais pas de diagnostic médical.
    Voici les données : ${context}`;

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
          { role: "user", content: "Génère mon briefing matinal." }
        ],
        max_tokens: 150,
        temperature: 0.6,
      }),
    });

    const data = await response.json();

    // ✅ On log la vraie erreur Groq si ça a échoué
    if (!response.ok) {
      console.error("[api/briefing] Erreur Groq:", response.status, data);
      throw new Error(`Groq ${response.status}`);
    }

    const briefing = data?.choices?.[0]?.message?.content;
    if (!briefing) {
      console.error("[api/briefing] Réponse Groq inattendue:", data);
      throw new Error("Réponse IA vide");
    }

    return NextResponse.json({ briefing });

  } catch (error) {
    console.error("[api/briefing] Exception:", error);
    return NextResponse.json({ 
      briefing: "Concentrez-vous sur votre récupération aujourd'hui. Un entraînement léger est recommandé." 
    });
  }
}