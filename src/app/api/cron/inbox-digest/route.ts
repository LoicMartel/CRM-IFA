import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/inbox/ingest";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  if (!isVercelCron && (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = svc();
  const { data } = await sb.from("conversations")
    .select("channel, agent_status, intent, contacts(first_name,last_name)")
    .in("agent_status", ["escalated", "human"]).eq("unread", true)
    .order("agent_status", { ascending: true });

  const lines = (data ?? []).map((c) => {
    const who = (Array.isArray(c.contacts) ? c.contacts[0] : c.contacts) as { first_name?: string; last_name?: string } | null;
    const name = `${who?.first_name ?? ""} ${who?.last_name ?? ""}`.trim() || "inconnu";
    return `${c.agent_status === "escalated" ? "🔴" : "🙋"} [${c.channel}] ${name}${c.intent === "rdv" ? " (RDV)" : c.intent === "devis" ? " (devis)" : ""}`;
  });
  const digest = lines.length ? `📥 Inbox — ${lines.length} à traiter :\n${lines.join("\n")}` : "✅ Inbox à jour.";
  return NextResponse.json({ ok: true, digest });
}
