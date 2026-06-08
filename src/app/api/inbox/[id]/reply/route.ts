import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { svc } from "@/lib/inbox/ingest";
import { resolveEmailReply } from "@/lib/inbox/threading";
import { SAFE_REPLY_CHANNELS, type Channel } from "@/lib/inbox/types";
import { sendChatMessage, sendEmail, unipileConfigured, type UnipileSendResult } from "@/lib/unipile/client";

const bodySchema = z.object({ body: z.string().trim().min(1).max(8000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const sb = svc();
  const { data: conv } = await sb.from("conversations")
    .select("channel, account_id, external_chat_id, subject, contacts(first_name, last_name, email)").eq("id", id).maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const channel = conv.channel as Channel;
  if (!SAFE_REPLY_CHANNELS.includes(channel)) return NextResponse.json({ error: "channel not replyable from CRM (open natively)" }, { status: 422 });
  if (!unipileConfigured()) return NextResponse.json({ error: "Unipile not configured" }, { status: 503 });

  // human takeover implicite + pause agent
  await sb.from("conversations").update({ agent_status: "human" }).eq("id", id);
  const { data: msg } = await sb.from("messages").insert({
    conversation_id: id, direction: "outbound", sent_by: "human", body: parsed.data.body, status: "validated",
  }).select("id").single();

  try {
    let ext: UnipileSendResult;
    if (channel === "email") {
      const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
      const c = contact as { first_name: string | null; last_name: string | null; email: string | null } | null;
      const to = c?.email;
      if (!to) throw new Error("no recipient email");
      const account = conv.account_id ?? process.env.UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID ?? null;
      if (!account) throw new Error("no email account (set UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID)");
      const thread = await resolveEmailReply(sb, id);
      const toName = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || null;
      ext = await sendEmail({ accountId: account, to, toName, subject: thread.subject ?? "Re: votre demande — La Closing Académie", body: parsed.data.body, replyTo: thread.replyTo });
    } else {
      if (!conv.external_chat_id) throw new Error("no chat id");
      ext = await sendChatMessage(conv.external_chat_id, parsed.data.body);
    }
    await sb.from("messages").update({ status: "sent", sent_at: new Date().toISOString(), external_message_id: ext.id }).eq("id", msg!.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    await sb.from("messages").update({ status: "failed" }).eq("id", msg!.id);
    console.error("[inbox.reply] send failed:", e);
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
}
