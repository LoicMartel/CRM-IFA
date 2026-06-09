import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestIncoming, svc } from "@/lib/inbox/ingest";
import { classifyConversation } from "@/lib/inbox/classify";
import { evaluateEligibility } from "@/lib/inbox/eligibility";
import { escalateConversation } from "@/lib/inbox/escalation";
import { runAgentTurn } from "@/lib/inbox/agent";
import type { Channel, IncomingMessage } from "@/lib/inbox/types";

// Unipile sends TWO distinct flat webhooks.
//  - email: E2E-validated 2026-06-08 against a real account. Flat fields incl. thread_id,
//    provider_id (string), email_id, from_attendee, body_plain, origin, event (mail_received|
//    mail_sent). Group by thread_id; provider_id = dedup key + reply_to target.
//    ⚠️ Default webhook events for source "email" = mail_received ONLY → at cutover also subscribe
//    mail_sent (anti-collision: human sends from the native client) when creating the webhook.
//  - messaging (LinkedIn/WhatsApp/Instagram/Messenger): E2E-validated 2026-06-09 against a real
//    WhatsApp account. Flat fields incl. account_type, chat_id, message (text), message_id,
//    sender{attendee_name, attendee_provider_id ("<digits>@lid"), attendee_public_identifier
//    ("<phone>@s.whatsapp.net"), attendee_specifics.phone_number}, and a top-level `is_sender`
//    boolean (true => the connected account sent it => self/outbound). ⚠️ There is NO
//    account_info.user_id (earlier doc-based assumption was wrong — caused self-sends to be
//    ingested as inbound leads). A separate "messaging" webhook is required.

function mapAccountType(t: string | undefined): Channel | null {
  switch ((t ?? "").toUpperCase()) {
    case "LINKEDIN": return "linkedin";
    case "WHATSAPP": return "whatsapp";
    case "INSTAGRAM": return "instagram";
    case "MESSENGER": case "FACEBOOK": return "messenger";
    // TELEGRAM / X / others: not modelled in the inbox → ignored.
    default: return null;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const attendeeSchema = z.object({
  display_name: z.string().optional().nullable(),
  identifier: z.string().optional().nullable(),
  identifier_type: z.string().optional().nullable(),
}).passthrough();

const emailSchema = z.object({
  email_id: z.string().optional(),
  account_id: z.string().optional(),
  event: z.string().optional(),
  subject: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  body_plain: z.string().optional().nullable(),
  from_attendee: attendeeSchema.optional().nullable(),
  provider_id: z.string().optional().nullable(), // provider msg id (string) — dedup key + reply_to target
  thread_id: z.string().optional().nullable(),   // provider thread id — conversation grouping key
  origin: z.string().optional().nullable(),       // "unipile" (sent via our API) | "external" (human's own client)
}).passthrough();

const messagingSchema = z.object({
  account_id: z.string().optional(),
  account_type: z.string().optional(),
  event: z.string().optional(),
  chat_id: z.string().optional().nullable(),
  message_id: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  is_sender: z.union([z.boolean(), z.number()]).optional().nullable(), // true/1 => connected account sent it (self/outbound)
  sender: z.object({
    attendee_name: z.string().optional().nullable(),
    attendee_provider_id: z.string().optional().nullable(),
    attendee_profile_url: z.string().optional().nullable(),
    attendee_public_identifier: z.string().optional().nullable(), // "<phone>@s.whatsapp.net" (phone-bearing)
    attendee_specifics: z.object({ phone_number: z.string().optional().nullable() }).passthrough().optional().nullable(),
  }).optional().nullable(),
}).passthrough();

function isEmailEvent(raw: Record<string, unknown>): boolean {
  const ev = String(raw.event ?? "");
  return "email_id" in raw || ev.startsWith("mail_");
}

type Mapped = IncomingMessage | { ignore: string };

function mapEmail(p: z.infer<typeof emailSchema>): Mapped {
  const ev = p.event ?? "mail_received";
  if (ev !== "mail_received" && ev !== "mail_sent") return { ignore: ev };
  const isOutbound = ev === "mail_sent";
  // Our own API sends echo back as mail_sent with origin "unipile" — already recorded, so ignore them.
  // Only a human's own-client send (origin "external", or unknown) is a real anti-collision takeover.
  if (isOutbound && p.origin === "unipile") return { ignore: "self-send" };
  const body = p.body_plain ?? (p.body ? stripHtml(p.body) : "");
  return {
    channel: "email",
    direction: isOutbound ? "outbound" : "inbound",
    accountId: p.account_id ?? null,
    externalChatId: p.thread_id ?? null,       // group emails by provider thread_id (like a chat)
    externalMessageId: p.provider_id ?? null,   // provider msg id = dedup key + reply_to target
    senderName: p.from_attendee?.display_name ?? null,
    senderHandle: p.from_attendee?.identifier ?? null,
    body,
    subject: p.subject ?? null,
  };
}

function mapMessaging(p: z.infer<typeof messagingSchema>): Mapped {
  const channel = mapAccountType(p.account_type);
  if (!channel) return { ignore: "account_type" };
  const ev = p.event ?? "message_received";
  if (ev !== "message_received") return { ignore: ev }; // reactions/read/edited/deleted/delivered
  // `is_sender` true => the connected account sent the message (another device or our own API) =>
  // outbound/self. Our own API sends are then deduped by external_message_id; a human's own-device
  // send is the real anti-collision takeover. (Validated E2E 2026-06-09 — the old account_info.user_id
  // comparison never matched, so self-sends were wrongly ingested as inbound leads.)
  const isOutbound = p.is_sender === true || p.is_sender === 1;
  const sender = p.sender;
  // For phone channels, match on the phone-bearing identifier, not the "<digits>@lid" provider id.
  const phoneHandle = sender?.attendee_specifics?.phone_number
    ?? sender?.attendee_public_identifier
    ?? sender?.attendee_provider_id
    ?? null;
  const handle = channel === "linkedin"
    ? (sender?.attendee_profile_url ?? sender?.attendee_provider_id ?? null)
    : phoneHandle;
  return {
    channel,
    direction: isOutbound ? "outbound" : "inbound",
    accountId: p.account_id ?? null,
    externalChatId: p.chat_id ?? null,
    externalMessageId: p.message_id ?? null,
    senderName: sender?.attendee_name ?? null,
    senderHandle: handle,
    body: p.message ?? "",
    subject: null,
  };
}

async function processInbound(result: NonNullable<Awaited<ReturnType<typeof ingestIncoming>>>, channel: Channel, body: string) {
  // classification best-effort
  await classifyConversation(result.conversationId).catch((e) => console.error("[unipile] classify:", e));
  const verdict = await evaluateEligibility(result.conversationId, result.isExistingContact, channel, body);
  const sb = svc();
  if (verdict.eligible) {
    await sb.from("conversations").update({ agent_status: "active" }).eq("id", result.conversationId);
    await runAgentTurn(result.conversationId).catch((e) => console.error("[unipile] agent:", e));
  } else if (verdict.reason) {
    await escalateConversation(result.conversationId, verdict.reason, "Détection automatique à la réception.");
  } else {
    await sb.from("conversations").update({ agent_status: "human" }).eq("id", result.conversationId);
  }
}

export async function POST(req: NextRequest) {
  // Shared-secret gate. This is a side-effecting public route (spends AI tokens, sends real
  // outbound messages, and a forged outbound can pause the agent). Fail closed in production:
  // the secret MUST be set there; in dev/preview it stays optional for local testing.
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get("x-webhook-secret") ?? req.nextUrl.searchParams.get("secret");
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  // Bound the body (defense against unbounded-payload DoS on a public route).
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  let raw: Record<string, unknown>;
  try { raw = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  let mapped: Mapped;
  if (isEmailEvent(raw)) {
    const parsed = emailSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ ok: true, ignored: "email-schema" });
    mapped = mapEmail(parsed.data);
  } else {
    const parsed = messagingSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ ok: true, ignored: "messaging-schema" });
    mapped = mapMessaging(parsed.data);
  }
  if ("ignore" in mapped) return NextResponse.json({ ok: true, ignored: mapped.ignore });

  try {
    const result = await ingestIncoming(mapped);
    if (!result) return NextResponse.json({ ok: true, dedup: true });

    if (result.direction === "outbound") {
      // Anti-collision: a human replied outside the CRM => the agent pauses.
      await svc().from("conversations").update({ agent_status: "human" }).eq("id", result.conversationId);
      return NextResponse.json({ ok: true, humanTakeover: true });
    }

    await processInbound(result, mapped.channel, mapped.body);
    return NextResponse.json({ ok: true, conversationId: result.conversationId });
  } catch (e) {
    console.error("[webhooks/unipile] error:", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // let Unipile retry
  }
}
