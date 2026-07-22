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

export interface ChatPeer {
  name: string | null;
  publicIdentifier: string | null; // e.g. Instagram username (without @)
}

// The messaging webhook often lacks attendee_name for Instagram/Messenger; the attendees
// endpoint has it (validated live 22/07: name + specifics.public_identifier). Best-effort.
export async function getChatPeer(chatId: string): Promise<ChatPeer | null> {
  if (!unipileConfigured()) return null;
  try {
    const res = await fetch(`${BASE}/api/v1/chats/${encodeURIComponent(chatId)}/attendees`, {
      headers: { "X-API-KEY": KEY, accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { items?: Array<{ is_self?: number | boolean; name?: string | null; specifics?: { public_identifier?: string | null } }> };
    const peer = (j.items ?? []).find((a) => !a.is_self);
    if (!peer) return null;
    return { name: peer.name?.trim() || null, publicIdentifier: peer.specifics?.public_identifier?.trim() || null };
  } catch {
    return null;
  }
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

const HTML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => HTML_ESCAPE[c]);
}

// Unipile renders the email `body` as HTML by default (sending plain text would require a
// `Content-Type: text/plain` custom header). A plain-text body therefore has its line breaks
// collapsed by the recipient's client — the formatting bug observed E2E (the agent's bullet
// lines arrived stuck together). We escape the agent's text, turn bare URLs into real anchors
// (the booking link is the speed-to-lead CTA → must stay clickable), then map newlines to <br>
// so the lead sees the same layout the agent wrote. The stored message body stays plain text.
function textToEmailHtml(text: string): string {
  const urlRe = /https?:\/\/[^\s<]+/g;
  let html = "";
  let last = 0;
  for (const m of text.matchAll(urlRe)) {
    const start = m.index ?? 0;
    // Don't swallow trailing sentence punctuation into the link.
    const url = m[0].replace(/[.,;:!?)]+$/, "");
    html += escapeHtml(text.slice(last, start));
    const safe = escapeHtml(url);
    html += `<a href="${safe}">${safe}</a>`;
    last = start + url.length;
  }
  html += escapeHtml(text.slice(last));
  return html.replace(/\r?\n/g, "<br>\n");
}

export async function sendEmail(params: SendEmailParams): Promise<UnipileSendResult> {
  const form = new FormData();
  form.append("account_id", params.accountId);
  form.append("subject", params.subject);
  form.append("body", textToEmailHtml(params.body));
  form.append("to", JSON.stringify([{ display_name: params.toName ?? undefined, identifier: params.to }]));
  if (params.replyTo) form.append("reply_to", params.replyTo);
  return unipilePost(`/emails`, form);
}

// P2 chantier C — déplacer un email dans un dossier IMAP (auto-classement, mode classify).
// Unipile: PUT /api/v1/emails/{email_id} body {folders:[name]}. IMAP (IONOS) n'accepte QU'UN dossier
// et le crée s'il n'existe pas. On cible le message par son provider_id (= notre external_message_id)
// + account_id en query (disambiguation). ⚠️ PENDING_VALIDATION E2E : le path accepte email_id Unipile
// en priorité ; l'usage du provider_id dans le path est l'option documentée mais non encore validée
// avec un vrai token. No-op si Unipile non configuré (gated : reste inerte sans token).
export async function moveEmailToFolder(accountId: string, providerId: string, folderName: string): Promise<void> {
  if (!unipileConfigured()) return; // gated: sans token, le P2 ne fait rien
  const url = `${BASE}/api/v1/emails/${encodeURIComponent(providerId)}?account_id=${encodeURIComponent(accountId)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "X-API-KEY": KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ folders: [folderName] }),
  });
  if (!res.ok) throw new Error(`Unipile move email → ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
