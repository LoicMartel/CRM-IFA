import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listClassifyAccountIds } from "@/lib/inbox/routing";

// Liste du tri courrier (chantier C) — UNIQUEMENT les conversations des comptes en mode `classify`
// (boîte de Rafi). Route DÉDIÉE (pas une extension de /api/inbox) pour garantir l'isolation : ce
// endpoint ne renvoie jamais de leads, /api/inbox ne renvoie jamais de courrier classify.
const COLS =
  "id, channel, subject, last_message_at, unread, account_id, triage_folder, triage_action_required, triage_assignee, triage_folder_reason, triage_folder_source, triage_assignee_source, contact_id, contacts(first_name,last_name,email)";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ids = await listClassifyAccountIds();
  if (ids.length === 0) return NextResponse.json({ conversations: [] });

  const folder = req.nextUrl.searchParams.get("folder");
  const action = req.nextUrl.searchParams.get("action"); // "true" => triage_action_required
  const assignee = req.nextUrl.searchParams.get("assignee");

  let q = sb.from("conversations").select(COLS).in("account_id", ids)
    .order("last_message_at", { ascending: false }).limit(200);
  if (folder) q = q.eq("triage_folder", folder);
  if (action === "true") q = q.eq("triage_action_required", true);
  if (assignee) q = q.eq("triage_assignee", assignee);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}
