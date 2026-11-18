// src/app/api/delete-account/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "ID utilisateur manquant" }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
    }

    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (getUserError || !user?.email) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    const userEmail = user.email;

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await resend.emails.send({
        from: "OMNIA <noreply@actoos.com>",
        to: userEmail,
        subject: "Votre compte OMNIA a été supprimé",
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compte supprimé</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f4f4f5" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; max-width: 600px; width: 100%; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <h1 style="color: #111827; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px;">OMNIA</h1>
              <p style="color: #0093E7; margin: 5px 0 0 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Personal Intelligence</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <h2 style="color: #111827; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Confirmation de suppression</h2>
              <p style="color: #4b5563; margin: 0 0 24px 0; font-size: 14px; line-height: 1.6;">
                Bonjour,
                <br><br>
                Nous vous confirmons que votre compte OMNIA ainsi que <strong>l'intégralité de vos données</strong> (santé, entraînements, nutrition, journal, etc.) ont été définitivement supprimés de nos serveurs.
              </p>
              <p style="color: #4b5563; margin: 0 0 24px 0; font-size: 14px; line-height: 1.6;">
                Conformément à notre politique de confidentialité et au RGPD, aucune copie de ces données n'est conservée.
              </p>
              <div style="background-color: #f9fafb; border-left: 3px solid #9ca3af; padding: 12px 16px; border-radius: 4px;">
                <p style="color: #6b7280; margin: 0; font-size: 12px; line-height: 1.5;">
                  <strong style="color: #374151;">Vous n'êtes pas à l'origine de cette suppression ?</strong><br>
                  Si vous pensez qu'il s'agit d'une erreur, veuillez contacter immédiatement notre support à <a href="mailto:contact@actoos.com" style="color: #0093E7; text-decoration: underline;">contact@actoos.com</a>.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px;">
              <p style="color: #9ca3af; margin: 0; font-size: 11px; line-height: 1.5; text-align: center;">
                Merci d'avoir utilisé OMNIA.<br>
                Propulsé par <strong style="color: #4b5563;">Actoos</strong>.<br><br>
                <a href="https://omnia.actoos.com/terms" style="color: #0093E7; text-decoration: underline;">Conditions d'utilisation</a> • 
                <a href="https://omnia.actoos.com/privacy" style="color: #0093E7; text-decoration: underline;">Politique de confidentialité</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      });
    } catch (emailError) {
      console.error("[delete-account] Erreur d'envoi email:", emailError);
    }

    return NextResponse.json({ success: true, message: "Compte supprimé définitivement." });

  } catch (error) {
    console.error("[delete-account] Exception:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}