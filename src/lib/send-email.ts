import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend() {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

export async function sendSessionEmail({
  to,
  subject,
  body,
  attachments,
}: {
  to: string;
  subject: string;
  body: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { success: false, error: "Resend not configured" };

  try {
    const htmlBody = body
      .replace(/\n/g, "<br>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

    const emailPayload: any = {
      from: "L'équipe La Closing Académie <noreply@closing-academie.com>",
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a2a3a; line-height: 1.6;">
          ${htmlBody}
          <hr style="border: none; border-top: 2px solid #FF6B35; margin: 30px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="vertical-align: top; padding-right: 20px; border-right: 2px solid #FF6B35;">
                <strong style="font-size: 16px;">Loïc MARTEL</strong><br>
                <span style="color: #5a6f80;">Consultant Expert Stratégie Commerciale</span><br>
                <span style="color: #5a6f80;">La Closing Académie ®</span>
              </td>
              <td style="vertical-align: top; padding-left: 20px;">
                📞 06 65 95 49 92<br>
                ✉️ loic@closing-academie.com<br>
                🔗 www.closing-academie.com
              </td>
            </tr>
          </table>
        </div>
      `,
    };

    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
        content_type: a.contentType || (a.filename.endsWith(".ics") ? "text/calendar" : a.filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
      }));
    }

    const { error } = await resend.emails.send(emailPayload);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
