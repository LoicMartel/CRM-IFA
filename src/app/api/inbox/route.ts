import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = req.nextUrl.searchParams.get("channel");
  const status = req.nextUrl.searchParams.get("status"); // agent_status filter
  const attention = req.nextUrl.searchParams.get("attention"); // "true" => escalated + human unread

  let q = sb.from("conversations")
    .select("id, channel, category, intent, agent_status, escalation_reason, unread, subject, last_message_at, contact_id, contacts(first_name,last_name,email)")
    .order("last_message_at", { ascending: false }).limit(200);
  if (channel) q = q.eq("channel", channel);
  if (status) q = q.eq("agent_status", status);
  if (attention === "true") q = q.in("agent_status", ["escalated", "human"]).eq("unread", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}
