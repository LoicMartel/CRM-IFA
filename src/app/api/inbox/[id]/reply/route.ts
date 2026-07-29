import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { svc } from "@/lib/inbox/ingest";
import { resolveEmailReply } from "@/lib/inbox/threading";
import { logMessageActivity } from "@/lib/inbox/activity";
import { SAFE_REPLY_CHANNELS, type Channel } from "@/lib/inbox/types";
import { resolveInboxAccount } from "@/lib/inbox/routing";
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
  // Garde-fou serveur (ceinture + bretelles) : une boîte en mode `classify` (tri courrier de Rafi)
  // ne doit JAMAIS envoyer, même via un POST direct sur cette route — le tri n'étiquette/range que
  // dans sa boîte, il ne répond pas. Ce contrôle ferme le chemin d'envoi côté serveur.
  const { mode } = await resolveInboxAccount(conv.account_id ?? null);
  if (mode === "classify") return NextResponse.json({ error: "Réponse interdite : boîte en mode tri (classify)" }, { status: 403 });
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
    // web_form n'a pas de fil de chat réel (external_chat_id synthétique webform-<email>) :
    // il répond par EMAIL, même chemin que l'agent (deliver() dans agent.ts).
    if (channel === "email" || channel === "web_form") {
      const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
      const c = contact as { first_name: string | null; last_name: string | null; email: string | null } | null;
      const to = c?.email;
      if (!to) throw new Error("no recipient email");
      const account = conv.account_id ?? process.env.UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID ?? null;
      if (!account) throw new Error("no email account (set UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID)");
      const thread = await resolveEmailReply(sb, id);
      const toName = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || null;
      ext = await sendEmail({ accountId: account, to, toName, subject: thread.subject ?? "Re: votre demande — IFA Formation", body: parsed.data.body, replyTo: thread.replyTo });
    } else {
      if (!conv.external_chat_id) throw new Error("no chat id");
      ext = await sendChatMessage(conv.external_chat_id, parsed.data.body);
    }
    await sb.from("messages").update({ status: "sent", sent_at: new Date().toISOString(), external_message_id: ext.id }).eq("id", msg!.id);
    // Trace la réponse humaine émise depuis le CRM dans la timeline d'activités (auteur = membre courant).
    const { data: member } = await sb.from("team_members").select("id").eq("auth_user_id", user.id).maybeSingle();
    await logMessageActivity(sb, id, { direction: "outbound", channel, sentBy: "human", body: parsed.data.body, teamMemberId: member?.id ?? null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await sb.from("messages").update({ status: "failed" }).eq("id", msg!.id);
    console.error("[inbox.reply] send failed:", e);
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
}
