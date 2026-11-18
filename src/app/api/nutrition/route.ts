// src/app/api/nutrition/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { mealType, pantry, userContext } = await req.json();

    // ✅ 1. Vérification de la clé API
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/nutrition] GROQ_API_KEY manquante dans .env.local");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    // ✅ 2. Formatage lisible du garde-manger (avec VRAIES unités)
    const availableIngredients = (pantry || [])
      .map((p: any) => {
        const qty = Number(p.quantity) || 0;
        const unit = (p.unit || "g").toString();
        if (unit === "g" && qty >= 1000) return `${p.name} (${(qty / 1000).toFixed(1)} kg)`;
        if (unit === "ml" && qty >= 1000) return `${p.name} (${(qty / 1000).toFixed(1)} L)`;
        if (unit === "unit") return `${p.name} (${qty} unité${qty > 1 ? "s" : ""})`;
        return `${p.name} (${qty} ${unit})`;
      })
      .join(", ");

    const systemPrompt = `Tu es OMNIA, un coach en nutrition sportive de haut niveau.
L'utilisateur souhaite préparer son repas : ${mealType}.

Voici le contexte global de sa journée : ${userContext}.

Voici EXACTEMENT ce qu'il a dans son garde-manger :
${availableIngredients || "Garde-manger vide (utilise des ingrédients classiques)."}

Ta mission :
Propose 3 options de repas adaptées à son contexte (fatigue, stress, objectif de poids).
Tu DOIS utiliser uniquement les ingrédients listés ci-dessus (tu peux supposer qu'il a du sel, poivre et huile d'olive).

⚠️ RÈGLES ABSOLUES POUR LES UNITÉS :
Choisis l'unité LA PLUS NATURELLE pour chaque ingrédient :
- Aliments comptables (œufs, bananes, yaourts, pommes, steaks, tranches de pain, avocats…) → "unit" ou "tranche" avec un nombre ENTIER (jamais de virgule).
- Aliments en vrac (riz, pâtes, farine, viande hachée, fromage râpé, légumes coupés…) → "g" (grammes).
- Liquides (lait, eau, jus, bouillon…) → "ml" (millilitres).
- Condiments et petites quantités (huile, sel, épices, miel…) → "c.à.s" (cuillère à soupe), "c.à.c" (cuillère à café) ou "pincée".

⚠️ SI UN INGRÉDIENT EST DANS LE GARDE-MANGER, utilise EXACTEMENT l'unité indiquée entre parenthèses.
Exemple : si le garde-manger indique "Œufs (12 unités)", écris { "name": "Œufs", "amount": 3, "unit": "unit" }.
Exemple : si le garde-manger indique "Riz basmati (500 g)", écris { "name": "Riz basmati", "amount": 80, "unit": "g" }.
Exemple : si le garde-manger indique "Lait d'amande (1 L)", écris { "name": "Lait d'amande", "amount": 200, "unit": "ml" }.

Exemples de bonnes combinaisons :
- Œuf : 3, "unit"
- Blanc de poulet : 150, "g"
- Riz basmati : 80, "g"
- Lait d'amande : 200, "ml"
- Huile d'olive : 1, "c.à.s"
- Pain complet : 2, "tranche"
- Banane : 1, "unit"
- Yaourt grec : 1, "unit"
- Sel : 1, "pincée"

Tu DOIS répondre STRICTEMENT sous ce format JSON (objet avec une clé "meals") :
{
  "meals": [
    {
      "name": "Omelette aux champignons",
      "description": "Riche en protéines, parfaite pour la récupération.",
      "ingredients": [
        { "name": "Œufs", "amount": 3, "unit": "unit" },
        { "name": "Champignons de Paris", "amount": 100, "unit": "g" },
        { "name": "Huile d'olive", "amount": 1, "unit": "c.à.s" }
      ],
      "calories": 420,
      "protein": 28,
      "carbs": 6,
      "fat": 32
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
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ [api/nutrition] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" },
        { status: 502 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("❌ [api/nutrition] Réponse Groq inattendue:", data);
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    let reply;
    try {
      reply = JSON.parse(content);
    } catch (parseError) {
      console.error("❌ [api/nutrition] Impossible de parser le JSON de l'IA:", content);
      return NextResponse.json({ error: "L'IA a renvoyé un format invalide" }, { status: 502 });
    }

    const meals = Array.isArray(reply)
      ? reply
      : (reply.meals || reply.options || Object.values(reply)[0]);

    if (!meals || !Array.isArray(meals)) {
      console.error("❌ [api/nutrition] Format de repas inattendu:", reply);
      return NextResponse.json({ error: "Format de repas invalide" }, { status: 502 });
    }

    return NextResponse.json({ meals });

  } catch (error) {
    console.error("❌ [api/nutrition] Exception:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}