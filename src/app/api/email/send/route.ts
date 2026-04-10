import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Fallback signature if member has no custom one
function defaultSignature() {
  return `
    <table style="width:100%"><tr><td height="20"></td></tr><tr><td style="border-top:2px solid #df7e0d"></td></tr><tr><td height="20"></td></tr></table>
    <table style="font-family:Arial,sans-serif;font-size:13px;color:#1a2a3a"><tr>
      <td style="vertical-align:top;padding-right:16px;border-right:2px solid #df7e0d">
        <strong style="font-size:14px">L'équipe La Closing Académie</strong><br>
        <span style="color:#5a6f80">La Closing Académie ®</span>
      </td>
      <td style="vertical-align:top;padding-left:16px;font-size:12px">
        ✉️ contact@closing-academie.com<br>
        🔗 www.closing-academie.com
      </td>
    </tr></table>`;
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, memberId, contactId } = await req.json();

    if (!to || !subject || !body || !memberId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get sender info including signature
    const { data: member } = await supabase
      .from("team_members")
      .select("first_name, last_name, email, phone, email_signature")
      .eq("id", memberId)
      .single();

    if (!member || !member.email) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const senderEmail = member.email.includes("@closing-academie.com")
      ? member.email
      : `${member.first_name.toLowerCase()}@closing-academie.com`;

    const htmlBody = body
      .replace(/\n/g, "<br>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

    const signature = member.email_signature || defaultSignature();

    const { data: emailData, error } = await resend.emails.send({
      from: `L'équipe La Closing Académie <contact@closing-academie.com>`,
      to: [to],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a2a3a; line-height: 1.6;">
          ${htmlBody}
          <br><br>
          ${signature}
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log as activity on the contact — store full HTML for viewing later
    if (contactId) {
      const fullHtml = `<div style="font-family:Arial,sans-serif;color:#1a2a3a;line-height:1.6">${htmlBody}</div>`;

      await supabase.from("activities").insert({
        type: "email",
        title: `Email : ${subject}`,
        description: `__EMAIL_HTML__${fullHtml}__END_HTML__\n\nDestinataire : ${to}\nObjet : ${subject}\n\n${body}`,
        contact_id: contactId,
        team_member_id: memberId,
        created_at: new Date().toISOString(),
      });

      // Update last_contacted_at
      await supabase.from("contacts").update({
        last_contacted_at: new Date().toISOString(),
      }).eq("id", contactId);
    }

    return NextResponse.json({ ok: true, emailId: emailData?.id });
  } catch (err: any) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
