import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { logEmail } from "@/lib/send-email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm-lca.vercel.app";

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    // Always return success to not reveal whether email exists
    if (error || !data?.properties?.hashed_token) {
      return NextResponse.json({ success: true });
    }

    const resetLink = `${appUrl}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery`;

    const subject = "Réinitialisation de votre mot de passe — IFA Formatio";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a2a3a; line-height: 1.7;">
        <div style="text-align: center; padding: 30px 0 20px;">
          <div style="display: inline-block; border: 2px solid #0f1630; border-radius: 10px; padding: 8px 12px;">
            <span style="color: #0f1630; font-size: 12px; font-weight: 700; line-height: 1.2; font-family: 'Montserrat', Arial, sans-serif;">
              LA<br>CLOSING<br>ACADÉMIE®
            </span>
          </div>
        </div>

        <p>Bonjour,</p>

        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>

        <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>

        <div style="margin: 24px 0; text-align: center;">
          <a href="${resetLink}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #E8732A 0%, #e65100 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Réinitialiser mon mot de passe
          </a>
        </div>

        <p style="font-size: 13px; color: #5a6f80;">Si vous n'avez pas fait cette demande, ignorez simplement cet email.</p>
        <p style="font-size: 13px; color: #5a6f80;">Ce lien expire dans 24 heures.</p>

        <hr style="border: none; border-top: 2px solid #E8732A; margin: 30px 0;">
        <p style="font-size: 11px; color: #8399a9; text-align: center;">
          © ${new Date().getFullYear()} IFA Formatio® — Tous droits réservés
        </p>
      </div>
    `;

    const { error: sendError } = await resend.emails.send({
      from: "IFA Formatio <noreply@ifagroupe.com>",
      to: [email],
      subject,
      html,
    });

    await logEmail({
      recipient: email,
      subject,
      transporter: "resend",
      status: sendError ? "failed" : "sent",
      error: sendError?.message,
      source: "auth/forgot-password",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
