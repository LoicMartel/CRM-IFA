import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestIncoming, svc } from "@/lib/inbox/ingest";
import { classifyConversation } from "@/lib/inbox/classify";
import { evaluateEligibility } from "@/lib/inbox/eligibility";
import { escalateConversation } from "@/lib/inbox/escalation";
import { runAgentTurn } from "@/lib/inbox/agent";
import type { Channel, IncomingMessage } from "@/lib/inbox/types";

function mapChannel(provider: string | undefined): Channel | null {
  switch ((provider ?? "").toUpperCase()) {
    case "LINKEDIN": return "linkedin";
    case "WHATSAPP": return "whatsapp";
    case "INSTAGRAM": return "instagram";
    case "MESSENGER": case "FACEBOOK": return "messenger";
    case "GMAIL": case "OUTLOOK": case "MAIL": case "EMAIL": return "email";
    default: return null;
  }
}

const payloadSchema = z.object({
  event: z.string().optional(),
  account_id: z.string().optional(),
  provider: z.string().optional(),
  message: z.object({
    id: z.string().optional(),
    chat_id: z.string().optional(),
    text: z.string().optional(),
    subject: z.string().optional(),
    is_sender: z.boolean().optional(), // true => message émis par le compte connecté (sortant)
    from: z.object({ name: z.string().optional(), identifier: z.string().optional() }).optional(),
  }).optional(),
}).passthrough();

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
  // Optional shared-secret gate. This is a side-effecting public route (spends AI tokens, sends real
  // outbound messages, and a forged `is_sender:true` can pause the agent), so enforce a secret when set.
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get("x-webhook-secret") ?? req.nextUrl.searchParams.get("secret");
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let parsed;
  try { parsed = payloadSchema.safeParse(await req.json()); }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }
  if (!parsed.success) return NextResponse.json({ ok: true, ignored: "schema" });

  const p = parsed.data;
  const channel = mapChannel(p.provider);
  if (!channel || !p.message) return NextResponse.json({ ok: true, ignored: "no-message-or-channel" });

  const isOutbound = p.message.is_sender === true;
  const incoming: IncomingMessage = {
    channel,
    direction: isOutbound ? "outbound" : "inbound",
    accountId: p.account_id ?? null,
    externalChatId: p.message.chat_id ?? null,
    externalMessageId: p.message.id ?? null,
    senderName: p.message.from?.name ?? null,
    senderHandle: p.message.from?.identifier ?? null,
    body: p.message.text ?? "",
    subject: p.message.subject ?? null,
  };

  try {
    const result = await ingestIncoming(incoming);
    if (!result) return NextResponse.json({ ok: true, dedup: true });

    if (result.direction === "outbound") {
      // Anti-collision: un humain a répondu hors CRM => l'agent se met en pause.
      await svc().from("conversations").update({ agent_status: "human" }).eq("id", result.conversationId);
      return NextResponse.json({ ok: true, humanTakeover: true });
    }

    await processInbound(result, channel, incoming.body);
    return NextResponse.json({ ok: true, conversationId: result.conversationId });
  } catch (e) {
    console.error("[webhooks/unipile] error:", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // laisse Unipile retenter
  }
}
