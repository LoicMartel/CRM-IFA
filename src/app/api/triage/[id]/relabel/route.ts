import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { svc } from "@/lib/inbox/ingest";
import { listClassifyAccountIds } from "@/lib/inbox/routing";
import { isValidFolder, isValidAssignee } from "@/lib/inbox/triage-config";

// Reclassement manuel : pose triage_folder_source / triage_assignee_source = 'human' → l'IA ne
// réécrit plus ce champ (verrou anti-écrasement appliqué dans classifyMailbox via .neq('human')).
const schema = z.object({
  triage_folder: z.string().optional(),
  triage_assignee: z.string().nullable().optional(),
  triage_action_required: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { triage_folder, triage_assignee, triage_action_required } = parsed.data;

  if (triage_folder !== undefined && !isValidFolder(triage_folder)) return NextResponse.json({ error: "invalid folder" }, { status: 400 });
  if (triage_assignee != null && !isValidAssignee(triage_assignee)) return NextResponse.json({ error: "invalid assignee" }, { status: 400 });

  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("account_id").eq("id", id).maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ids = await listClassifyAccountIds();
  const acc = (conv as { account_id: string | null }).account_id;
  if (!acc || !ids.includes(acc)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (triage_folder !== undefined) { patch.triage_folder = triage_folder; patch.triage_folder_source = "human"; }
  if (triage_assignee !== undefined) { patch.triage_assignee = triage_assignee; patch.triage_assignee_source = "human"; }
  if (triage_action_required !== undefined) { patch.triage_action_required = triage_action_required; }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, noop: true });

  const { error } = await sb.from("conversations").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
