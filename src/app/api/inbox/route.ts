import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listClassifyAccountIds, classifyExclusionOr } from "@/lib/inbox/routing";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = req.nextUrl.searchParams.get("channel");
  const status = req.nextUrl.searchParams.get("status"); // agent_status filter
  const attention = req.nextUrl.searchParams.get("attention"); // "true" => escalated + human unread

  // Isolation : l'inbox leads EXCLUT les comptes en mode `classify` (le courrier de Rafi est rangé
  // dans sa boîte via IMAP, jamais affiché ici — sinon il fuite dans la liste leads).
  const exclusionOr = classifyExclusionOr(await listClassifyAccountIds());

  const BASE_COLS = "id, channel, category, intent, agent_status, escalation_reason, unread, subject, last_message_at, contact_id, contacts(first_name,last_name,email)";

  const build = (cols: string) => {
    let q = sb.from("conversations").select(cols)
      .order("last_message_at", { ascending: false }).limit(200);
    if (exclusionOr) q = q.or(exclusionOr);
    if (channel) q = q.eq("channel", channel);
    if (status) q = q.eq("agent_status", status);
    if (attention === "true") q = q.in("agent_status", ["escalated", "human"]).eq("unread", true);
    return q;
  };

  // interest_score/score_reason (scoring copilote F P1) n'existent qu'après leur migration →
  // fallback sans ces colonnes si elle n'est pas encore appliquée (undefined column = 42703).
  let { data, error } = await build(`${BASE_COLS}, interest_score, score_reason`);
  if (error && (error.code === "42703" || /interest_score|score_reason/.test(error.message ?? ""))) {
    ({ data, error } = await build(BASE_COLS));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}
