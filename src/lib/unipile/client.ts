const BASE = process.env.UNIPILE_DSN ?? "";
const KEY = process.env.UNIPILE_API_KEY ?? "";

export function unipileConfigured(): boolean {
  return Boolean(BASE && KEY);
}

async function unipileFetch(path: string, init: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-API-KEY": KEY, "Content-Type": "application/json", accept: "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Unipile ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function sendChatMessage(chatId: string, text: string): Promise<{ id: string }> {
  return unipileFetch(`/chats/${chatId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
}

export async function sendEmail(accountId: string, to: string, subject: string, body: string): Promise<{ id: string }> {
  return unipileFetch(`/emails`, {
    method: "POST",
    body: JSON.stringify({ account_id: accountId, to: [{ identifier: to }], subject, body }),
  });
}
