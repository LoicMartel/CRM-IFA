import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, memberId, contactId } = await req.json();

    if (!to || !subject || !body || !memberId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Get sender info
    const { data: member } = await supabase
      .from("team_members")
      .select("first_name, last_name, email, phone")
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

    const { data: emailData, error } = await resend.emails.send({
      from: `${member.first_name} ${member.last_name} <${senderEmail}>`,
      to: [to],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a2a3a; line-height: 1.6;">
          ${htmlBody}
          <br><br>
          <hr style="border: none; border-top: 2px solid #FF6B35; margin: 20px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="vertical-align: top; padding-right: 20px; border-right: 2px solid #FF6B35;">
                <strong style="font-size: 14px;">${member.first_name} ${member.last_name}</strong><br>
                <span style="color: #5a6f80; font-size: 12px;">La Closing Académie ®</span>
              </td>
              <td style="vertical-align: top; padding-left: 20px; font-size: 12px;">
                ${member.phone ? `📞 ${member.phone}<br>` : ""}
                ✉️ ${member.email}<br>
                🔗 www.closing-academie.com
              </td>
            </tr>
          </table>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log as activity on the contact
    if (contactId) {
      await supabase.from("activities").insert({
        type: "email",
        title: `Email : ${subject}`,
        description: body,
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
