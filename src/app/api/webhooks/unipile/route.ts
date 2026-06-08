import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestIncoming, svc } from "@/lib/inbox/ingest";
import { classifyConversation } from "@/lib/inbox/classify";
import { evaluateEligibility } from "@/lib/inbox/eligibility";
import { escalateConversation } from "@/lib/inbox/escalation";
import { runAgentTurn } from "@/lib/inbox/agent";
import type { Channel, IncomingMessage } from "@/lib/inbox/types";

// Unipile sends TWO distinct flat webhooks (verified vs developer.unipile.com 2026-06-08):
//  - messaging (LinkedIn/WhatsApp/Instagram/Messenger): account_type, chat_id, message (text), sender{...}
//  - email (Gmail/Outlook/IMAP): email_id, event (mail_received|mail_sent|mail_moved), from_attendee, in_reply_to, origin
// E2E with a real payload is pending the Unipile token.

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
  message_id: z.string().optional().nullable(),
  in_reply_to: z.object({
    message_id: z.string().optional().nullable(),
    id: z.string().optional().nullable(),
  }).optional().nullable(),
  origin: z.string().optional().nullable(), // "unipile" (sent via our API) | "external" (human's own client)
}).passthrough();

const messagingSchema = z.object({
  account_id: z.string().optional(),
  account_type: z.string().optional(),
  event: z.string().optional(),
  chat_id: z.string().optional().nullable(),
  message_id: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  account_info: z.object({ user_id: z.string().optional().nullable() }).optional().nullable(),
  sender: z.object({
    attendee_name: z.string().optional().nullable(),
    attendee_provider_id: z.string().optional().nullable(),
    attendee_profile_url: z.string().optional().nullable(),
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
    externalChatId: null, // email threading keys off the root email id, computed in ingest
    externalMessageId: p.email_id ?? null,
    inReplyToExternalId: p.in_reply_to?.id ?? null,
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
  // No is_sender flag: a message is self-sent (another device or our API) when the connected
  // account's user_id equals the sender's provider id. Our own API sends are then deduped by
  // external_message_id; a human's own-device send is the real anti-collision takeover.
  const selfId = p.account_info?.user_id ?? null;
  const senderId = p.sender?.attendee_provider_id ?? null;
  const isOutbound = Boolean(selfId && senderId && selfId === senderId);
  const handle = channel === "linkedin"
    ? (p.sender?.attendee_profile_url ?? p.sender?.attendee_provider_id ?? null)
    : (p.sender?.attendee_provider_id ?? null);
  return {
    channel,
    direction: isOutbound ? "outbound" : "inbound",
    accountId: p.account_id ?? null,
    externalChatId: p.chat_id ?? null,
    externalMessageId: p.message_id ?? null,
    senderName: p.sender?.attendee_name ?? null,
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
