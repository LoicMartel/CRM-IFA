import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/inbox/ingest";
import { listClassifyAccountIds, classifyExclusionOr } from "@/lib/inbox/routing";
import { createNotification } from "@/lib/notifications";
import { sendSessionEmail } from "@/lib/send-email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  if (!isVercelCron && (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = svc();
  // Isolation : le digest leads ne doit PAS inclure le courrier classify de Rafi (human + unread)
  // — sinon ses mails polluent son récap leads. On exclut les comptes en mode `classify`.
  const exclusionOr = classifyExclusionOr(await listClassifyAccountIds());
  let dq = sb.from("conversations")
    .select("channel, agent_status, intent, contacts(first_name,last_name)")
    .in("agent_status", ["escalated", "human"]).eq("unread", true)
    .order("agent_status", { ascending: true });
  if (exclusionOr) dq = dq.or(exclusionOr);
  const { data } = await dq;

  const lines = (data ?? []).map((c) => {
    const who = (Array.isArray(c.contacts) ? c.contacts[0] : c.contacts) as { first_name?: string; last_name?: string } | null;
    const name = `${who?.first_name ?? ""} ${who?.last_name ?? ""}`.trim() || "inconnu";
    return `${c.agent_status === "escalated" ? "🔴" : "🙋"} [${c.channel}] ${name}${c.intent === "rdv" ? " (RDV)" : c.intent === "devis" ? " (devis)" : ""}`;
  });

  // Inbox à jour → pas de livraison (anti-spam : on ne notifie que s'il y a du travail).
  if (lines.length === 0) {
    return NextResponse.json({ ok: true, count: 0, delivered: false });
  }

  const digest = `📥 Inbox — ${lines.length} conversation(s) à traiter :\n${lines.join("\n")}`;

  // Destinataire (Rafi par défaut) résolu avec id (cloche) ET email (récap) en une requête.
  const ownerEmail = process.env.INBOX_DEFAULT_OWNER_EMAIL ?? "rafi@closing-academie.com";
  const { data: owner } = await sb.from("team_members").select("id, email").ilike("email", ownerEmail).maybeSingle();

  if (!owner?.id) {
    // Fail loud : sans destinataire, le digest ne serait livré nulle part (sinon perte silencieuse).
    console.error(`[cron.inbox-digest] no recipient resolved for ${ownerEmail} — digest NOT delivered (${lines.length} pending). Check INBOX_DEFAULT_OWNER_EMAIL.`);
    return NextResponse.json({ ok: false, count: lines.length, delivered: false, reason: "no_recipient" });
  }

  await createNotification({
    recipientId: owner.id,
    type: "new_lead",
    title: `📥 Inbox — ${lines.length} à traiter`,
    body: lines.slice(0, 10).join("\n"),
    linkUrl: "/inbox",
  }).catch((e) => console.error("[cron.inbox-digest] bell failed:", e));

  let emailDelivered = false;
  if (owner.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm-lca.vercel.app";
    const res = await sendSessionEmail({
      to: owner.email,
      subject: `📥 Inbox du jour — ${lines.length} à traiter`,
      body: `${digest}\n\nOuvrir l'inbox : ${appUrl}/inbox`,
    });
    emailDelivered = res.success;
    if (!res.success) console.error("[cron.inbox-digest] email failed:", res.error);
  }

  return NextResponse.json({ ok: true, count: lines.length, delivered: true, email: emailDelivered });
}
