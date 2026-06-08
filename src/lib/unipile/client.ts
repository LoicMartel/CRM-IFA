// Unipile unified-messaging client.
// Email send E2E-validated 2026-06-08: POST /api/v1/emails returns {object,tracking_id,provider_id}
// (no id/message_id/email_id) — we use provider_id as the message id. reply_to takes the parent's
// provider_id (string) and threads correctly (the reply shares the parent's thread_id). Chat send
// response shape is still doc-based (parsed defensively).
// UNIPILE_DSN is the DSN root (e.g. https://{sub}.unipile.com:{port}) WITHOUT /api/v1 — the client
// adds it. Send endpoints expect multipart/form-data.
const BASE = process.env.UNIPILE_DSN ?? "";
const KEY = process.env.UNIPILE_API_KEY ?? "";

export interface UnipileSendResult {
  id: string | null;
}

export function unipileConfigured(): boolean {
  return Boolean(BASE && KEY);
}

async function unipilePost(path: string, form: FormData): Promise<UnipileSendResult> {
  // No Content-Type header: fetch derives the multipart boundary from the FormData body.
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: "POST",
    headers: { "X-API-KEY": KEY, accept: "application/json" },
    body: form,
  });
  if (!res.ok) throw new Error(`Unipile ${path} → ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // EmailSent => provider_id (no id). Keep other keys as fallbacks for the chat endpoint.
  const id = (j.provider_id ?? j.id ?? j.message_id ?? j.email_id ?? j.tracking_id ?? null) as string | null;
  if (!id) console.warn(`[unipile] ${path} returned no id — dedup/threading will degrade for this message`);
  return { id };
}

export async function sendChatMessage(chatId: string, text: string): Promise<UnipileSendResult> {
  const form = new FormData();
  form.append("text", text);
  return unipilePost(`/chats/${chatId}/messages`, form);
}

export interface SendEmailParams {
  accountId: string;
  to: string;
  toName?: string | null;
  subject: string;
  body: string;
  // provider_id of the email being replied to → keeps the reply in the same provider thread
  // (validated E2E 2026-06-08: reply_to=provider_id lands the reply in the parent's thread_id).
  replyTo?: string | null;
}

export async function sendEmail(params: SendEmailParams): Promise<UnipileSendResult> {
  const form = new FormData();
  form.append("account_id", params.accountId);
  form.append("subject", params.subject);
  form.append("body", params.body);
  form.append("to", JSON.stringify([{ display_name: params.toName ?? undefined, identifier: params.to }]));
  if (params.replyTo) form.append("reply_to", params.replyTo);
  return unipilePost(`/emails`, form);
}
