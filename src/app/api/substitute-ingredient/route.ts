// src/app/api/substitute-ingredient/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { meal, ingredient, pantry, userPreference } = await req.json();

    if (!meal || !ingredient) {
      return NextResponse.json({ error: "Repas ou ingrédient manquant" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("❌ [api/substitute-ingredient] GROQ_API_KEY manquante");
      return NextResponse.json({ error: "Clé API IA non configurée" }, { status: 500 });
    }

    // Résumé du garde-manger pour que l'IA puisse proposer des alternatives déjà dispo
    const pantryList = (pantry || [])
      .map((p: any) => `${p.name} (${p.quantity} ${p.unit})`)
      .join(", ") || "vide";

    // Tous les autres ingrédients du plat (contexte important pour la cohérence)
    const otherIngredients = (meal.ingredients || [])
      .filter((ing: any) => ing.name !== ingredient.name)
      .map((ing: any) => `${ing.name} (${ing.amount} ${ing.unit})`)
      .join(", ") || "aucun autre";

    const systemPrompt = `Tu es OMNIA, un chef nutritionniste sportif d'élite.

L'utilisateur prépare le plat "${meal.name}" et veut REMPLACER un ingrédient.

INGRÉDIENT À REMPLACER :
- ${ingredient.name} (${ingredient.amount} ${ingredient.unit})

AUTRES INGRÉDIENTS DU PLAT (à préserver) :
${otherIngredients}

MACROS ACTUELLES DU PLAT :
- ${meal.calories} kcal · ${meal.protein}g P · ${meal.carbs}g G · ${meal.fat}g L

GARDE-MANGER DE L'UTILISATEUR (à privilégier si possible) :
${pantryList}

${userPreference ? `PRÉFÉRENCE UTILISATEUR : "${userPreference}"` : ""}

Ta mission : propose EXACTEMENT 3 substituts viables et cohérents avec ce plat.
Pour chacun, tu dois :
1. Donner le nom du substitut, sa quantité et son unité NATURELLE
   (unité pour aliments comptables, g pour vrac, ml pour liquides, c.à.s/c.à.c/pincée pour condiments).
2. Expliquer en 1 phrase COURTE pourquoi c'est une bonne alternative (goût, santé, coût).
3. RECALCULER les macros TOTALES du plat complet avec ce substitut (newTotals).
4. Indiquer le delta calorique (caloriesDelta = newCalories - ${meal.calories}).
5. Indiquer si le substitut est présent dans le garde-manger (fromPantry : true/false).

⚠️ Réponds STRICTEMENT en JSON valide :
{
  "substitutes": [
    {
      "name": "Huile de tournesol",
      "amount": 1,
      "unit": "c.à.s",
      "reason": "Goût neutre, disponible partout.",
      "newTotals": { "calories": 510, "protein": 28, "carbs": 6, "fat": 33 },
      "caloriesDelta": 0,
      "fromPantry": true
    }
  ]
}

Contraintes :
- Les 3 substituts doivent être DIFFÉRENTS entre eux.
- Reste réaliste : ne remplace pas 100g de poulet par 1kg de tofu.
- Ne propose pas un substitut qui casserait complètement le plat.
- Si aucun substitut viable n'existe, retourne { "substitutes": [] }.`;

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
          { role: "user", content: `Propose 3 alternatives pour "${ingredient.name}".` },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ [api/substitute-ingredient] Erreur Groq:", response.status, JSON.stringify(data));
      return NextResponse.json(
        { error: `Erreur Groq ${response.status}`, detail: data?.error?.message ?? "inconnue" },
        { status: 502 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "L'IA n'a pas renvoyé de texte" }, { status: 502 });
    }

    let reply;
    try {
      reply = JSON.parse(content);
    } catch {
      console.error("❌ [api/substitute-ingredient] JSON invalide:", content);
      return NextResponse.json({ error: "Format invalide" }, { status: 502 });
    }

    const substitutes = Array.isArray(reply.substitutes) ? reply.substitutes : [];
    if (substitutes.length === 0) {
      return NextResponse.json({ error: "Aucun substitut viable trouvé" }, { status: 422 });
    }

    return NextResponse.json({ substitutes });

  } catch (error) {
    console.error("❌ [api/substitute-ingredient] Exception:", error);
    return NextResponse.json(
      { error: "Erreur lors de la substitution.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}