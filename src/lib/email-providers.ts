import { Resend } from "resend";
import { getValidToken, type OAuthProvider } from "@/lib/oauth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailProvider = "resend" | "gmail" | "outlook";

export interface EmailProviderConfig {
  provider: EmailProvider;
  /** Resend only: user's own API key (null = use platform key) */
  resend_api_key?: string | null;
  /** Resend only: custom sender email */
  resend_from_email?: string | null;
  /** Resend only: custom sender name */
  resend_from_name?: string | null;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
}

export interface SendEmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Gmail — send via Gmail API using OAuth token
// ---------------------------------------------------------------------------

function buildMimeMessage(params: SendEmailParams): string {
  const boundary = "----=_Part_" + Date.now().toString(36);
  const lines = [
    `From: ${params.fromName} <${params.fromEmail}>`,
    `To: ${params.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.html).toString("base64").replace(/(.{76})/g, "$1\n"),
    `--${boundary}--`,
  ];
  return lines.join("\r\n");
}

function base64url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendViaGmail(
  memberId: string,
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const accessToken = await getValidToken(memberId, "google" as OAuthProvider);
  if (!accessToken) {
    return { success: false, error: "Compte Google non connecté ou token expiré. Reconnectez votre compte dans les paramètres." };
  }

  const raw = base64url(buildMimeMessage(params));

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[Gmail] Send failed:", res.status, errBody);
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        error: "Permission Gmail insuffisante. Déconnectez puis reconnectez votre compte Google dans les paramètres.",
      };
    }
    return { success: false, error: `Erreur Gmail (${res.status})` };
  }

  const data = await res.json();
  return { success: true, emailId: data.id };
}

// ---------------------------------------------------------------------------
// Outlook — send via Microsoft Graph API using OAuth token
// ---------------------------------------------------------------------------

export async function sendViaOutlook(
  memberId: string,
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const accessToken = await getValidToken(memberId, "microsoft" as OAuthProvider);
  if (!accessToken) {
    return { success: false, error: "Compte Microsoft non connecté ou token expiré. Reconnectez votre compte dans les paramètres." };
  }

  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me/sendMail",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: {
            contentType: "HTML",
            content: params.html,
          },
          toRecipients: [
            {
              emailAddress: {
                address: params.to,
              },
            },
          ],
        },
        saveToSentItems: true,
      }),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[Outlook] Send failed:", res.status, errBody);
    if (res.status === 401 || res.status === 403) {
      return {
        success: false,
        error: "Permission Outlook insuffisante. Déconnectez puis reconnectez votre compte Microsoft dans les paramètres.",
      };
    }
    return { success: false, error: `Erreur Outlook (${res.status})` };
  }

  // Microsoft Graph sendMail returns 202 with no body on success
  return { success: true };
}

// ---------------------------------------------------------------------------
// Resend — send via user's own Resend API key
// ---------------------------------------------------------------------------

export async function sendViaResend(
  apiKey: string,
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: `${params.fromName} <${params.fromEmail}>`,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, emailId: data?.id };
}
