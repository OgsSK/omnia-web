// src/app/api/auth/withings/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId requis" }, { status: 400 });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.WITHINGS_CLIENT_ID || "",
    redirect_uri: process.env.WITHINGS_REDIRECT_URI || "",
    scope: "user.metrics,user.activity",
    state: userId, 
  });

  return NextResponse.redirect(`https://account.withings.com/oauth2_user/authorize2?${params.toString()}`);
}