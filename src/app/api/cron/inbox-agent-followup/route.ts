import { NextRequest, NextResponse } from "next/server";
import { svc } from "@/lib/inbox/ingest";
import { runAgentTurn } from "@/lib/inbox/agent";
import { FOLLOWUP_DELAY_HOURS, MAX_AGENT_TURNS } from "@/lib/inbox/types";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  if (!isVercelCron && (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = svc();
  const cutoff = new Date(Date.now() - FOLLOWUP_DELAY_HOURS * 3600_000).toISOString();
  const { data: stale } = await sb.from("conversations")
    .select("id, agent_turn_count")
    .eq("agent_status", "active")
    // include never-acted convs (NULL): in Postgres `NULL < cutoff` is unknown, so a bare `.lt`
    // would leave them stuck active forever (never relaunched, never dormant).
    .or(`agent_last_acted_at.is.null,agent_last_acted_at.lt.${cutoff}`);

  let relaunched = 0, dormant = 0;
  for (const c of stale ?? []) {
    if ((c.agent_turn_count ?? 0) >= MAX_AGENT_TURNS) {
      await sb.from("conversations").update({ agent_status: "dormant" }).eq("id", c.id);
      dormant++;
    } else {
      await runAgentTurn(c.id, true).catch((e) => console.error("[cron.followup] turn:", e));
      relaunched++;
    }
  }
  return NextResponse.json({ ok: true, relaunched, dormant });
}
