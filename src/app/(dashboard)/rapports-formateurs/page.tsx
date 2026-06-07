import { createClient } from "@/lib/supabase/server";
import { TrainerReportClient, type Row } from "./rapports-formateurs-client";

// Rapport collector WF-009 : suggestion (IA) vs réalité (deals.trainer_id) sur les deals
// ayant un retour, pour mesurer le taux de match et réentraîner. Dégrade en liste vide tant
// que la migration wf009 n'est pas appliquée.
export default async function TrainerReportPage() {
  const sb = await createClient();

  const { data: deals } = await sb
    .from("deals")
    .select("id, name, wf009_suggested_trainer_id, wf009_suggestion_correct, wf009_feedback, trainer_id")
    .or("wf009_suggestion_correct.not.is.null,wf009_suggested_trainer_id.not.is.null")
    .limit(500);

  const { data: members } = await sb.from("team_members").select("id, first_name, last_name");
  const nameById = new Map<string, string>(
    (members ?? []).map((m: { id: string; first_name: string | null; last_name: string | null }) =>
      [m.id, `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.id]),
  );

  const rows: Row[] = (deals ?? []).map((d: {
    id: string; name: string | null;
    wf009_suggested_trainer_id: string | null;
    wf009_suggestion_correct: boolean | null;
    wf009_feedback: string | null;
    trainer_id: string | null;
  }) => ({
    id: d.id,
    name: d.name ?? "(sans nom)",
    suggested: d.wf009_suggested_trainer_id ? (nameById.get(d.wf009_suggested_trainer_id) ?? "?") : null,
    actual: d.trainer_id ? (nameById.get(d.trainer_id) ?? "?") : null,
    correct: d.wf009_suggestion_correct,
    feedback: d.wf009_feedback,
  }));

  return <TrainerReportClient rows={rows} />;
}
