import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { requireMember } from "@/lib/api-auth";
import { logEmail } from "@/lib/send-email";
import {
  sendViaGmail,
  sendViaOutlook,
  sendViaResend,
  type EmailProvider,
  type EmailProviderConfig,
  type SendEmailParams,
} from "@/lib/email-providers";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Fallback signature if member has no custom one
function defaultSignature(member: { first_name: string; last_name: string; email: string; phone: string | null }) {
  return `
    <table style="width:100%"><tr><td height="20"></td></tr><tr><td style="border-top:2px solid #df7e0d"></td></tr><tr><td height="20"></td></tr></table>
    <table style="font-family:Arial,sans-serif;font-size:13px;color:#1a2a3a"><tr>
      <td style="vertical-align:top;padding-right:16px;border-right:2px solid #df7e0d">
        <strong style="font-size:14px">${member.first_name} ${member.last_name}</strong><br>
        <span style="color:#5a6f80">IFA Formatio ®</span>
      </td>
      <td style="vertical-align:top;padding-left:16px;font-size:12px">
        ${member.phone ? `📞 ${member.phone}<br>` : ""}
        ✉️ ${member.email}<br>
        🔗 www.ifagroupe.com
      </td>
    </tr></table>`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireMember();
    if (auth instanceof NextResponse) return auth;

    const { to, subject, body, memberId, contactId } = await req.json();

    if (!to || !subject || !body || !memberId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get sender info including signature and email config
    const { data: member } = await supabase
      .from("team_members")
      .select("first_name, last_name, email, phone, email_signature, integration_config")
      .eq("id", memberId)
      .single();

    if (!member || !member.email) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const htmlBody = body
      .replace(/\n/g, "<br>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

    const signature = member.email_signature || defaultSignature(member);

    const fullHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a2a3a; line-height: 1.6;">
        ${htmlBody}
        <br><br>
        ${signature}
      </div>
    `;

    // Determine email provider from integration_config
    const ic = (member.integration_config as Record<string, unknown>) ?? {};
    const emailConfig: EmailProviderConfig = {
      provider: (ic.email_provider as EmailProvider) ?? null,
      resend_api_key: ic.resend_api_key as string | null,
      resend_from_email: ic.resend_from_email as string | null,
      resend_from_name: ic.resend_from_name as string | null,
    };

    const provider = emailConfig.provider;
    let transporter: string = "resend";
    let sendResult: { success: boolean; emailId?: string; error?: string };

    if (provider === "gmail") {
      // ── Gmail via OAuth ──
      transporter = "gmail";

      // Fetch the provider email from oauth_tokens for the "from" field
      const { data: oauthRow } = await supabase
        .from("oauth_tokens")
        .select("provider_email")
        .eq("team_member_id", memberId)
        .eq("provider", "google")
        .maybeSingle();

      const fromEmail = oauthRow?.provider_email ?? member.email;

      sendResult = await sendViaGmail(memberId, {
        to,
        subject,
        html: fullHtml,
        fromName: `${member.first_name} ${member.last_name}`,
        fromEmail,
      });

    } else if (provider === "outlook") {
      // ── Outlook via Microsoft Graph ──
      transporter = "outlook";

      sendResult = await sendViaOutlook(memberId, {
        to,
        subject,
        html: fullHtml,
        fromName: `${member.first_name} ${member.last_name}`,
        fromEmail: member.email,
      });

    } else if (provider === "resend" && emailConfig.resend_api_key) {
      // ── Resend avec clé personnelle ──
      transporter = "resend";
      const fromEmail = emailConfig.resend_from_email ?? member.email;
      const fromName = emailConfig.resend_from_name ?? `${member.first_name} ${member.last_name}`;

      sendResult = await sendViaResend(emailConfig.resend_api_key, {
        to,
        subject,
        html: fullHtml,
        fromName,
        fromEmail,
      });

    } else {
      // ── Resend par défaut (clé plateforme) ──
      transporter = "resend";
      const senderEmail = member.email.includes("@ifagroupe.com")
        ? member.email
        : `${member.first_name.toLowerCase()}@ifagroupe.com`;

      const { data: emailData, error } = await resend.emails.send({
        from: `${member.first_name} ${member.last_name} <${senderEmail}>`,
        to: [to],
        subject,
        html: fullHtml,
      });

      sendResult = error
        ? { success: false, error: error.message }
        : { success: true, emailId: emailData?.id };
    }

    // Log to email_log
    await logEmail({
      recipient: to,
      subject,
      body,
      transporter: transporter as "resend" | "ionos" | "unipile" | "gmail" | "outlook",
      status: sendResult.success ? "sent" : "failed",
      error: sendResult.error,
      relatedEntityType: contactId ? "contact" : undefined,
      relatedEntityId: contactId ?? undefined,
      source: "email/send",
    });

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error }, { status: 500 });
    }

    // Log as activity on the contact
    if (contactId) {
      const activityHtml = `<div style="font-family:Arial,sans-serif;color:#1a2a3a;line-height:1.6">${htmlBody}</div>`;

      await supabase.from("activities").insert({
        type: "email",
        title: `Email : ${subject}`,
        description: `__EMAIL_HTML__${activityHtml}__END_HTML__\n\nDestinataire : ${to}\nObjet : ${subject}\n\n${body}`,
        contact_id: contactId,
        team_member_id: memberId,
        created_at: new Date().toISOString(),
      });

      // Update last_contacted_at
      await supabase.from("contacts").update({
        last_contacted_at: new Date().toISOString(),
      }).eq("id", contactId);
    }

    return NextResponse.json({ ok: true, emailId: sendResult.emailId });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
