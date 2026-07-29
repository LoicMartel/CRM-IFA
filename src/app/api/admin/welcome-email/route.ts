import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { logEmail } from "@/lib/send-email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { firstName, email, password } = await req.json();

    if (!firstName || !email) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm-lca.vercel.app";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a2a3a; line-height: 1.7;">
        <div style="text-align: center; padding: 30px 0 20px;">
          <div style="display: inline-block; border: 2px solid #0f1630; border-radius: 10px; padding: 8px 12px;">
            <span style="color: #0f1630; font-size: 12px; font-weight: 700; line-height: 1.2; font-family: 'Montserrat', Arial, sans-serif;">
              LA<br>CLOSING<br>ACADÉMIE®
            </span>
          </div>
        </div>

        <p>Bonjour <strong>${firstName}</strong>,</p>

        <p>Bienvenue au sein de <strong>IFA Formatio</strong> !</p>

        <p>Votre espace membre est désormais actif. Vous pouvez y accéder dès maintenant pour suivre vos contacts, gérer votre pipeline commercial et consulter vos rendez-vous.</p>

        <div style="margin: 24px 0; text-align: center;">
          <a href="${appUrl}/login" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #0f1630 0%, #1E2A5A 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Accéder à mon espace
          </a>
        </div>

        <div style="background: #f0f7fb; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
          <p style="margin: 0 0 6px; font-weight: 700; font-size: 14px;">Vos identifiants :</p>
          <p style="margin: 0; font-size: 14px;">📧 Email : <strong>${email}</strong></p>
          ${password ? `<p style="margin: 4px 0 0; font-size: 14px;">🔑 Mot de passe : <strong>${password}</strong></p>` : ""}
          <p style="margin: 8px 0 0; font-size: 12px; color: #5a6f80;">Nous vous recommandons de modifier votre mot de passe lors de votre première connexion.</p>
        </div>

        <p>Si vous avez la moindre question, n'hésitez pas à nous contacter.</p>

        <p>À très bientôt,</p>
        <p><strong>L'équipe IFA Formatio</strong></p>

        <hr style="border: none; border-top: 2px solid #E8732A; margin: 30px 0;">
        <p style="font-size: 11px; color: #8399a9; text-align: center;">
          © ${new Date().getFullYear()} IFA Formatio® — Tous droits réservés
        </p>
      </div>
    `;

    const subject = "Bienvenue sur votre espace CRM — IFA Formatio";
    const { error } = await resend.emails.send({
      from: "IFA Formatio <noreply@ifagroupe.com>",
      to: [email],
      subject,
      html,
    });

    await logEmail({
      recipient: email,
      subject,
      transporter: "resend",
      status: error ? "failed" : "sent",
      error: error?.message,
      source: "admin/welcome-email",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
