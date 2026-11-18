// src/app/api/auth/withings/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/devices?error=auth_failed`);
  }

  try {
    const tokenResponse = await fetch("https://wbsapi.withings.net/v2/oauth2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "requesttoken",
        grant_type: "authorization_code",
        client_id: process.env.WITHINGS_CLIENT_ID!,
        client_secret: process.env.WITHINGS_CLIENT_SECRET!,
        code: code,
        redirect_uri: process.env.WITHINGS_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.status !== 0) {
      console.error("Erreur Withings:", tokenData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/devices?error=token_failed`);
    }

    const { access_token, refresh_token, expires_in } = tokenData.body;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: dbError } = await supabaseAdmin
      .from("omnia_sources")
      .upsert({
        user_id: userId,
        name: "withings",
        display_name: "Balance Withings",
        auth_status: "connected",
        access_token: access_token,
        refresh_token: refresh_token,
        token_expires_at: expiresAt,
        last_sync_at: new Date().toISOString()
      }, { onConflict: "user_id, name" });

    if (dbError) {
      console.error("Erreur BDD:", dbError);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/devices?error=db_failed`);
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/devices?success=withings_connected`);

  } catch (err) {
    console.error("Exception Callback:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/devices?error=exception`);
  }
}