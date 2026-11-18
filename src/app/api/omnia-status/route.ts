// src/app/api/omnia-status/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { recovery, sleep, fatigue, injuries, journalCount, testsCount } = await req.json();

    let status = "optimal";
    let recommendation = "";

    // Logique déterministe (pas besoin d'IA pour ça, c'est plus fiable)
    if (injuries > 0) {
      status = "warning";
      recommendation = "Vous avez une blessure active. Priorité à la récupération et aux exercices de substitution.";
    } else if (recovery < 40 || sleep < 6) {
      status = "rest";
      recommendation = "Votre récupération est faible. Privilégiez une séance légère ou de la mobilité aujourd'hui.";
    } else if (recovery > 80 && sleep > 7.5) {
      status = "optimal";
      recommendation = "Vous êtes en pleine forme ! C'est le moment de pousser l'intensité.";
    } else {
      status = "neutral";
      recommendation = "Votre état est stable. Maintenez votre routine actuelle.";
    }

    // Si on a beaucoup de tests mais peu de journal, on peut ajouter une note
    if (testsCount > 5 && journalCount < 3) {
      recommendation += " Pensez à noter vos ressentis dans le journal pour qu'OMNIA affine son analyse.";
    }

    return NextResponse.json({ status, recommendation });

  } catch (error) {
    return NextResponse.json({ error: "Erreur d'analyse" }, { status: 500 });
  }
}