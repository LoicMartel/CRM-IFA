import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { requireMember } from "@/lib/api-auth";
import { logEmail } from "@/lib/send-email";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

    const { to, contactFirstName, companyName, memberId, contactId, dealId, pdfBase64 } = await req.json();

    if (!memberId || !pdfBase64) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Resolve recipient email from contactId if not provided
    let recipientEmail = to;
    if (!recipientEmail && contactId) {
      const { data: contact } = await supabase.from("contacts").select("email").eq("id", contactId).single();
      recipientEmail = contact?.email;
    }
    if (!recipientEmail) {
      return NextResponse.json({ error: "Aucun email trouvé pour ce contact" }, { status: 400 });
    }

    const { data: member } = await supabase
      .from("team_members")
      .select("first_name, last_name, email, phone, email_signature")
      .eq("id", memberId)
      .single();

    if (!member || !member.email) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const senderEmail = member.email.includes("@ifagroupe.com")
      ? member.email
      : `${member.first_name.toLowerCase()}@ifagroupe.com`;

    // QW-1 (demande Rafi/Loïc) : sujet court. À valider Loïc.
    const subject = `Votre devis — IFA Formatio®`;

    const greeting = contactFirstName ? `Bonjour ${contactFirstName},` : "Bonjour,";

    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a2a3a; line-height: 1.8;">
        <p>${greeting}</p>
        <p>Suite à notre échange, veuillez trouver ci-joint notre proposition de formation personnalisée${companyName ? ` pour <strong>${companyName}</strong>` : ""}.</p>
        <p>Cette cotation détaille l'ensemble du programme envisagé : le planning prévisionnel, le volume horaire et le budget associé.</p>
        <p>Je reste à votre entière disposition pour en discuter et adapter cette proposition selon vos besoins.</p>
        <p>Bien cordialement,</p>
        <br>
        ${member.email_signature || defaultSignature(member)}
      </div>
    `;

    const { data: emailData, error } = await resend.emails.send({
      from: `${member.first_name} ${member.last_name} <${senderEmail}>`,
      to: [recipientEmail],
      subject,
      html: bodyHtml,
      attachments: [
        {
          filename: `Cotation_${(companyName || "client").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          content: pdfBase64,
          contentType: "application/pdf",
        },
      ],
    });

    await logEmail({
      recipient: recipientEmail,
      subject,
      transporter: "resend",
      status: error ? "failed" : "sent",
      error: error?.message,
      hasAttachments: true,
      attachmentCount: 1,
      relatedEntityType: dealId ? "deal" : contactId ? "contact" : undefined,
      relatedEntityId: dealId ?? contactId ?? undefined,
      source: "cotation/send-email",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log as activity
    if (contactId) {
      await supabase.from("activities").insert({
        type: "email",
        title: `Email : ${subject}`,
        description: `__EMAIL_HTML__${bodyHtml}__END_HTML__\n\nDestinataire : ${recipientEmail}\nObjet : ${subject}\n\nCotation envoyée par email.`,
        contact_id: contactId,
        team_member_id: memberId,
        created_at: new Date().toISOString(),
      });

      await supabase.from("contacts").update({
        last_contacted_at: new Date().toISOString(),
      }).eq("id", contactId);
    }

    // Save PDF as document in the deal
    if (dealId && pdfBase64) {
      try {
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const filename = `Cotation_${(companyName || "client").replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.pdf`;
        const storagePath = `${dealId}/${filename}`;
        await supabase.storage.from("deal-documents").upload(storagePath, pdfBuffer, { contentType: "application/pdf" });
        await supabase.from("deal_documents").insert({
          deal_id: dealId,
          name: filename,
          file_path: storagePath,
          file_size: pdfBuffer.length,
          file_type: "application/pdf",
          document_type: "devis",
        });
      } catch (docErr) {
        console.error("Error saving PDF to deal:", docErr);
      }
    }

    return NextResponse.json({ ok: true, emailId: emailData?.id });
  } catch (err) {
    console.error("Cotation email error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
