import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireMember } from "@/lib/api-auth";

// Typé SupabaseClient (générique Database par défaut = any) : les colonnes wf009_* sont neuves
// et pas encore dans les types générés → `.update()`/`.select()` restent souples.
const sb: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET : état courant du collector pour ce deal + liste des formateurs (dropdown "suggéré").
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  let current = { suggestedTrainerId: null as string | null, correct: null as boolean | null, feedback: null as string | null };
  const { data, error } = await sb
    .from("deals")
    .select("wf009_suggested_trainer_id, wf009_suggestion_correct, wf009_feedback")
    .eq("id", id)
    .maybeSingle();
  // Si la migration n'est pas encore appliquée (colonnes absentes), on dégrade : valeurs vides.
  if (!error && data) {
    current = {
      suggestedTrainerId: data.wf009_suggested_trainer_id ?? null,
      correct: data.wf009_suggestion_correct ?? null,
      feedback: data.wf009_feedback ?? null,
    };
  }

  const { data: trainers } = await sb
    .from("team_members")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true });

  return NextResponse.json({ current, trainers: trainers ?? [] });
}

// POST : enregistre la suggestion WF-009 + si elle était correcte + une note.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  let body: { suggestedTrainerId?: string | null; correct?: boolean | null; feedback?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ("suggestedTrainerId" in body) update.wf009_suggested_trainer_id = body.suggestedTrainerId || null;
  if ("correct" in body) update.wf009_suggestion_correct = typeof body.correct === "boolean" ? body.correct : null;
  if ("feedback" in body) update.wf009_feedback = body.feedback?.trim() ? body.feedback.trim() : null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await sb.from("deals").update(update).eq("id", id);
  if (error) {
    // Probable si la migration wf009 n'est pas encore appliquée côté DB.
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
