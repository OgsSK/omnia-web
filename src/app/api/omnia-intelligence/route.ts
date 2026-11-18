// src/app/api/omnia-intelligence/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  // 1. Récupération des données du jour
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { data: metrics, error } = await supabase
    .from('measurements')
    .select('metric_type, value, unit, confidence_level, source_id')
    .eq('user_id', user.id)
    .gte('measured_at', startOfDay.toISOString())
    .lte('measured_at', endOfDay.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Préparation du contexte pour l'IA
  // On formate les données pour que l'IA les comprenne facilement
  let contextData = "Aucune donnée de check-in aujourd'hui.";
  
  if (metrics && metrics.length > 0) {
    const sleep = metrics.find(m => m.metric_type === 'sleep_duration');
    const fatigue = metrics.find(m => m.metric_type === 'subjective_fatigue');
    const stress = metrics.find(m => m.metric_type === 'subjective_stress');

    contextData = `
      - Sommeil : ${sleep ? `${sleep.value} heures (Source: ${sleep.confidence_level})` : "Non renseigné"}
      - Fatigue subjective : ${fatigue ? `${fatigue.value}/10 (Source: ${fatigue.confidence_level})` : "Non renseigné"}
      - Stress subjectif : ${stress ? `${stress.value}/10 (Source: ${stress.confidence_level})` : "Non renseigné"}
    `;
  }

  // 3. Appel à l'IA Groq
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
  }

  const systemPrompt = `Tu es OMNIA, une intelligence personnelle experte en performance sportive et récupération.
  Ton but est de croiser les données mesurées (hardware) et déclarées (ressenti de l'utilisateur) pour donner un conseil du jour.

  Voici les données de l'utilisateur pour aujourd'hui :
  ${contextData}

  Ta mission :
  Rédige une recommandation personnalisée en 2 ou 3 phrases maximum.
  - Sois direct, bienveillant et professionnel.
  - Si la fatigue ou le stress sont élevés, conseille de lever le pied.
  - Si le sommeil est bon et la fatigue basse, encourage à performer.
  - Termine par une action concrète pour la journée.`;

  try {
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
          { role: "user", content: "Génère ma recommandation du jour." }
        ],
        temperature: 0.6,
        max_tokens: 250,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ [api/omnia-intelligence] Erreur Groq:", data);
      return NextResponse.json({ error: "Erreur de l'IA" }, { status: 502 });
    }

    const recommendationText = data?.choices?.[0]?.message?.content;

    // 4. On garde une logique simple juste pour la couleur de la carte sur le Dashboard
    let status = "normal";
    const sleepVal = metrics?.find(m => m.metric_type === 'sleep_duration')?.value || 0;
    const fatigueVal = metrics?.find(m => m.metric_type === 'subjective_fatigue')?.value || 0;

    if (fatigueVal >= 7) status = "rest";
    else if (sleepVal > 0 && sleepVal < 6) status = "warning";
    else if (sleepVal >= 7 && fatigueVal <= 4) status = "optimal";

    return NextResponse.json({
      status: status,
      recommendation: recommendationText || "Impossible de générer une recommandation.",
      analyzed_data: metrics
    });

  } catch (error) {
    console.error("❌ [api/omnia-intelligence] Exception:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}