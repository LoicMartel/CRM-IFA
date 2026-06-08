import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage } from "./types";
import { normalizeSubject } from "./threading";

export function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function resolveOwnerId(sb: ReturnType<typeof svc>): Promise<string | null> {
  const email = process.env.INBOX_DEFAULT_OWNER_EMAIL ?? "rafi@closing-academie.com";
  const { data } = await sb.from("team_members").select("id").ilike("email", email).maybeSingle();
  return data?.id ?? null;
}

// Returns { contactId, isExisting }. isExisting=true means the sender matched a contact that
// already has a deal (=> not a "new lead", agent must NOT auto-handle).
async function matchContact(
  sb: ReturnType<typeof svc>,
  msg: IncomingMessage
): Promise<{ contactId: string | null; isExisting: boolean }> {
  const handle = msg.senderHandle?.trim();
  if (!handle) return { contactId: null, isExisting: false };
  let contactId: string | null = null;
  if (msg.channel === "email" && handle.includes("@")) {
    const { data } = await sb.from("contacts").select("id").ilike("email", handle).maybeSingle();
    contactId = data?.id ?? null;
  } else if (msg.channel === "linkedin" && handle.startsWith("http")) {
    const { data } = await sb.from("contacts").select("id").ilike("linkedin_url", `%${handle}%`).maybeSingle();
    contactId = data?.id ?? null;
  } else if (["whatsapp", "sms"].includes(msg.channel)) {
    const { data } = await sb.from("contacts").select("id").ilike("phone", `%${handle.replace(/\D/g, "").slice(-9)}%`).maybeSingle();
    contactId = data?.id ?? null;
  }
  if (!contactId) return { contactId: null, isExisting: false };
  // Existing contact "qui n'est pas un nouveau lead" = a au moins un deal rattaché
  const { count } = await sb.from("deals").select("id", { count: "exact", head: true }).eq("contact_id", contactId);
  return { contactId, isExisting: (count ?? 0) > 0 };
}

async function createContact(sb: ReturnType<typeof svc>, msg: IncomingMessage, ownerId: string | null): Promise<string | null> {
  const name = (msg.senderName ?? "Inconnu").trim().split(" ");
  const insert: Record<string, unknown> = {
    first_name: name[0] || "Inconnu",
    last_name: name.slice(1).join(" ") || "",
    contact_type: "inbound",
    lifecycle_stage: "lead_marketing",
    owner_id: ownerId,
    notes: `Créé automatiquement depuis l'inbox (${msg.channel}).`,
  };
  if (msg.channel === "email" && msg.senderHandle?.includes("@")) insert.email = msg.senderHandle;
  if (msg.channel === "linkedin" && msg.senderHandle?.startsWith("http")) insert.linkedin_url = msg.senderHandle;
  if (["whatsapp", "sms"].includes(msg.channel) && msg.senderHandle) insert.phone = msg.senderHandle;
  const { data, error } = await sb.from("contacts").insert(insert).select("id").single();
  if (error) { console.error("[inbox.ingest] createContact failed:", error.message); return null; }
  return data.id;
}

// Email has no native thread_id. We thread via Unipile ids: a reply carries in_reply_to.id
// (= parent email's Unipile id), and we stored that id as the parent message's external_message_id.
async function resolveEmailConversation(
  sb: ReturnType<typeof svc>,
  msg: IncomingMessage,
  contactId: string | null
): Promise<string | null> {
  // 1) Direct parent link via Unipile id.
  if (msg.inReplyToExternalId) {
    const { data: parent } = await sb.from("messages").select("conversation_id")
      .eq("external_message_id", msg.inReplyToExternalId).maybeSingle();
    if (parent?.conversation_id) return parent.conversation_id as string;
  }
  // 2) Fallback: same contact + same normalized subject. Email threads only (never web_form,
  //    whose subject is generic and would wrongly merge distinct emails) and non-empty subject.
  if (contactId && msg.subject) {
    const target = normalizeSubject(msg.subject);
    if (target) {
      const { data: candidates } = await sb.from("conversations")
        .select("id, subject")
        .eq("contact_id", contactId)
        .eq("channel", "email")
        .order("last_message_at", { ascending: false })
        .limit(20);
      const hit = (candidates ?? []).find(
        (c) => c.subject && normalizeSubject(c.subject as string) === target
      );
      if (hit) return hit.id as string;
    }
  }
  return null;
}

export interface IngestResult {
  conversationId: string;
  isNewConversation: boolean;
  isExistingContact: boolean;
  direction: "inbound" | "outbound";
}

/** Idempotent ingestion of one message. Returns null if it was a duplicate. */
export async function ingestIncoming(msg: IncomingMessage): Promise<IngestResult | null> {
  const sb = svc();

  if (msg.externalMessageId) {
    const { data: dup } = await sb.from("messages").select("conversation_id").eq("external_message_id", msg.externalMessageId).maybeSingle();
    if (dup) return null;
  }

  const ownerId = await resolveOwnerId(sb);
  let conversationId: string | null = null;
  let isNewConversation = false;

  // Resolve a contact match once (used for grouping fallbacks and conversation creation).
  const matched = await matchContact(sb, msg);
  const isExistingContact = matched.isExisting;

  if (msg.channel === "email") {
    conversationId = await resolveEmailConversation(sb, msg, matched.contactId);
  } else if (msg.externalChatId) {
    const { data: existing } = await sb.from("conversations").select("id")
      .eq("channel", msg.channel).eq("external_chat_id", msg.externalChatId).maybeSingle();
    conversationId = existing?.id ?? null;
  }

  // Don't materialize a conversation (and a self-contact) for an untracked outbound message;
  // anti-collision only applies to threads we already follow.
  if (!conversationId && msg.direction === "outbound") return null;

  if (!conversationId) {
    const contactId = matched.contactId ?? (await createContact(sb, msg, ownerId));
    // Email threads are keyed by the root email's own Unipile id; chat by the provider chat id.
    const externalChatId = msg.channel === "email" ? msg.externalMessageId : msg.externalChatId;
    const { data, error } = await sb.from("conversations").insert({
      contact_id: contactId,
      channel: msg.channel,
      account_id: msg.accountId,
      external_chat_id: externalChatId,
      subject: msg.subject ?? null,
      owner_id: ownerId,
      unread: true,
    }).select("id").single();
    if (error?.code === "23505" && externalChatId) {
      // Concurrent first-message delivery created the conversation first — adopt the winner.
      const { data: winner } = await sb.from("conversations").select("id")
        .eq("channel", msg.channel).eq("external_chat_id", externalChatId).maybeSingle();
      conversationId = winner?.id ?? null;
      if (!conversationId) { console.error("[inbox.ingest] conversation insert race unresolved"); return null; }
    } else if (error || !data) {
      console.error("[inbox.ingest] conversation insert failed:", error?.message); return null;
    } else {
      conversationId = data.id;
      isNewConversation = true;
    }
  } else if (msg.direction === "inbound") {
    await sb.from("conversations").update({ unread: true, last_message_at: new Date().toISOString() }).eq("id", conversationId);
  }

  if (!conversationId) return null; // narrow: both branches above set it or returned early

  // Echo guard: Unipile mirrors our own agent/CRM sends back as outbound webhooks. Without a
  // guaranteed id match we'd double-insert and self-pause the agent, so an identical recent
  // outbound in the same conversation is treated as that echo (deduped).
  if (msg.direction === "outbound") {
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: echo } = await sb.from("messages").select("id")
      .eq("conversation_id", conversationId).eq("direction", "outbound")
      .eq("body", msg.body).gte("created_at", since).limit(1).maybeSingle();
    if (echo) return null;
  }

  const { error: msgErr } = await sb.from("messages").insert({
    conversation_id: conversationId,
    direction: msg.direction,
    sent_by: msg.direction === "inbound" ? "lead" : "human", // outbound capté via webhook = humain hors CRM
    sender_name: msg.senderName,
    sender_handle: msg.senderHandle,
    body: msg.body,
    external_message_id: msg.externalMessageId,
    status: msg.direction === "inbound" ? "received" : "sent",
    sent_at: msg.direction === "outbound" ? new Date().toISOString() : null,
  });
  if (msgErr && msgErr.code !== "23505") console.error("[inbox.ingest] message insert failed:", msgErr.message);

  return { conversationId, isNewConversation, isExistingContact, direction: msg.direction };
}
