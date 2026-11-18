// src/app/api/chat/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, context } = await req.json();

    // ✅ 1. Vérification de la clé
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/chat] GROQ_API_KEY est introuvable dans .env.local");
      return NextResponse.json({ 
        reply: "Erreur de configuration : la clé API est manquante. Vérifiez votre fichier .env.local." 
      }, { status: 500 });
    }

    const systemPrompt = `Tu es OMNIA, une intelligence personnelle premium et experte en performance sportive.
    Tu analyses les données de l'utilisateur et tu lui réponds de manière concise (maximum 3 phrases), factuelle et encourageante.
    Ne fais pas de diagnostic médical. Utilise un ton professionnel et direct.

    Voici les données réelles de l'utilisateur pour contexte : ${context || "Aucune donnée"}`;

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
          { role: "user", content: message }
        ],
        max_tokens: 300,
        temperature: 0.7, 
      }),
    });

    const data = await response.json();

    // ✅ 2. Log de l'erreur exacte de Groq
    if (!response.ok) {
      console.error("❌ [api/chat] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json({ 
        reply: `L'IA a renvoyé une erreur (${response.status}). Regardez votre terminal.` 
      }, { status: 500 });
    }

    // ✅ 3. Protection contre les réponses malformées
    const aiReply = data?.choices?.[0]?.message?.content;
    if (!aiReply) {
      console.error("❌ [api/chat] Format inattendu:", data);
      return NextResponse.json({ reply: "L'IA n'a pas renvoyé de texte." }, { status: 500 });
    }

    return NextResponse.json({ reply: aiReply });

  } catch (error) {
    console.error("❌ [api/chat] Exception attrapée:", error);
    return NextResponse.json({ 
      reply: "Je rencontre une petite difficulté technique. Veuillez réessayer plus tard." 
    }, { status: 500 });
  }
}