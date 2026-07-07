import { Resend } from "resend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let resendClient: Resend | null = null;

function getResend() {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

// ── Journal d'audit des emails sortants (preuve Qualiopi) ──────────────────────
// Source de vérité opposable : chaque envoi est journalisé dans `email_log`, quel
// que soit le transporteur. Best-effort : un échec de log NE BLOQUE JAMAIS l'envoi
// (et dégrade proprement si la table n'est pas encore créée côté DB).

// Annoté `SupabaseClient` (générique Database par défaut = any) pour que `.from(...)`
// reste souple : les tables neuves ne sont pas encore dans les types générés.
let logClient: SupabaseClient | null = null;
function getLogClient() {
  if (logClient) return logClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  logClient = createClient(url, key, { auth: { persistSession: false } });
  return logClient;
}

export type EmailTransporter = "resend" | "ionos" | "unipile";

export interface EmailLogEntry {
  recipient: string;
  subject?: string;
  body?: string;
  transporter?: EmailTransporter;
  status: "sent" | "failed";
  error?: string;
  hasAttachments?: boolean;
  attachmentCount?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  source?: string;
}

export async function logEmail(entry: EmailLogEntry): Promise<void> {
  try {
    const sb = getLogClient();
    if (!sb) return;
    const { error } = await sb.from("email_log").insert({
      recipient: entry.recipient,
      subject: entry.subject ?? null,
      body: entry.body ?? null,
      transporter: entry.transporter ?? "resend",
      status: entry.status,
      error: entry.error ?? null,
      has_attachments: entry.hasAttachments ?? false,
      attachment_count: entry.attachmentCount ?? 0,
      related_entity_type: entry.relatedEntityType ?? null,
      related_entity_id: entry.relatedEntityId ?? null,
      source: entry.source ?? null,
    });
    if (error) console.warn("[email-log] insert failed (non-blocking):", error.message);
  } catch (e) {
    console.warn("[email-log] insert threw (non-blocking):", e instanceof Error ? e.message : String(e));
  }
}

// Couture transporteur. IONOS (SMTP transactionnel non-sensible, vrai @closing-academie.com)
// n'est PAS encore câblé : activation = `npm i nodemailer` + IONOS_SMTP_* en env + helper d'envoi.
// Tant que ce n'est pas le cas, tout part via Resend. Exposé pour brancher le routage futur
// sans toucher aux call sites. ⚠️ Périmètre : devis/conventions (Firma) + factures (Pennylane)
// restent sur leurs canaux trackés, JAMAIS IONOS.
export function ionosConfigured(): boolean {
  return Boolean(process.env.IONOS_SMTP_HOST && process.env.IONOS_SMTP_USER && process.env.IONOS_SMTP_PASS);
}

/**
 * Trace optionnelle d'un email CLIENT en activité sur la fiche (follow-up demandé
 * par Loïc). À ne passer QUE pour les emails réellement adressés au client/apprenant
 * — jamais pour les notifs internes (équipe/formateurs), sinon la fiche se pollue.
 */
export interface EmailActivityLog {
  title: string;
  description?: string;
  type?: string;
  company_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  team_member_id?: string | null;
}

// Rate limiting: max 4 emails/sec to stay under Resend's 5/sec limit
let lastSendTime = 0;
const MIN_INTERVAL_MS = 300;

async function rateLimitDelay() {
  const now = Date.now();
  const elapsed = now - lastSendTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastSendTime = Date.now();
}

export async function sendSessionEmail({
  to,
  subject,
  body,
  attachments,
  bcc,
  isHtml = false,
  logActivity,
  relatedEntityType,
  relatedEntityId,
  source,
}: {
  to: string;
  subject: string;
  body: string;
  attachments?: { filename: string; content: string | Buffer; contentType?: string }[];
  bcc?: string[];
  isHtml?: boolean;
  logActivity?: EmailActivityLog;
  // Contexte optionnel pour le journal d'audit (rétrocompat : les appelants existants n'y touchent pas).
  relatedEntityType?: string;
  relatedEntityId?: string;
  source?: string;
}): Promise<{ success: boolean; error?: string }> {
  const hasAttachments = Boolean(attachments && attachments.length > 0);
  const logCtx = {
    recipient: to,
    subject,
    body,
    transporter: "resend" as const, // cf. ionosConfigured() — couture IONOS inactive en V1
    hasAttachments,
    attachmentCount: attachments?.length ?? 0,
    relatedEntityType,
    relatedEntityId,
    source,
  };

  const resend = getResend();
  if (!resend) {
    await logEmail({ ...logCtx, status: "failed", error: "Resend not configured" });
    return { success: false, error: "Resend not configured" };
  }

  try {
    const htmlBody = isHtml
      ? body
      : body
        .replace(/\n/g, "<br>")
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

    const emailPayload: {
      from: string;
      to: string;
      subject: string;
      bcc?: string[];
      html: string;
      attachments?: { filename: string; content: string; contentType: string }[];
    } = {
      from: "L'équipe La Closing Académie <noreply@closing-academie.com>",
      to,
      subject,
      ...(bcc && bcc.length > 0 ? { bcc } : {}),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #1a2a3a; line-height: 1.6;">
          ${htmlBody}
          <hr style="border: none; border-top: 2px solid #FF6B35; margin: 30px 0;">
          <table style="width: 100%;">
            <tr>
              <td style="vertical-align: top; padding-right: 20px; border-right: 2px solid #FF6B35;">
                <strong style="font-size: 16px;">L'équipe La Closing Académie</strong><br>
                <span style="color: #5a6f80;">La Closing Académie ®</span>
              </td>
              <td style="vertical-align: top; padding-left: 20px;">
                ✉️ contact@closing-academie.com<br>
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
        content: Buffer.isBuffer(a.content)
          ? a.content.toString("base64")
          : Buffer.from(a.content, "utf-8").toString("base64"),
        contentType: a.contentType || (a.filename.endsWith(".ics") ? "text/calendar; method=REQUEST; charset=utf-8" : a.filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
      }));
    }

    await rateLimitDelay();
    const { error } = await resend.emails.send(emailPayload as Parameters<typeof resend.emails.send>[0]);

    if (error) {
      await logEmail({ ...logCtx, status: "failed", error: error.message });
      return { success: false, error: error.message };
    }
    await logEmail({ ...logCtx, status: "sent" });

    // Trace best-effort de l'email client en activité (ne fait jamais échouer l'envoi).
    if (logActivity && (logActivity.company_id || logActivity.contact_id || logActivity.deal_id)) {
      const supabase = getLogClient();
      if (supabase) {
        try {
          await supabase.from("activities").insert({
            type: logActivity.type ?? "email",
            title: logActivity.title,
            description: logActivity.description ?? null,
            company_id: logActivity.company_id ?? null,
            contact_id: logActivity.contact_id ?? null,
            deal_id: logActivity.deal_id ?? null,
            team_member_id: logActivity.team_member_id ?? null,
            created_at: new Date().toISOString(),
          });
        } catch (logErr) {
          console.error("[sendSessionEmail] logActivity insert failed:", logErr);
        }
      }
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmail({ ...logCtx, status: "failed", error: message });
    return { success: false, error: message };
  }
}
