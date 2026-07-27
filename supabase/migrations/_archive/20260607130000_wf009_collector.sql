-- Collector WF-009 : capture sur le deal de la suggestion formateur (IA) vs la réalité,
-- pour réentraîner/affiner le matching (besoin CR 04/06 : ~30-40 deals avant itération utile).
-- La "réalité" (formateur réellement assigné) = deals.trainer_id (déjà existant).
-- À appliquer via le SQL editor Supabase (token Management expiré côté Teina). Idempotent.

alter table deals add column if not exists wf009_suggested_trainer_id uuid;
alter table deals add column if not exists wf009_suggestion_correct boolean;
alter table deals add column if not exists wf009_feedback text;

-- Index partiel pour le rapport (deals ayant un retour collector).
create index if not exists deals_wf009_feedback_idx
  on deals (wf009_suggestion_correct)
  where wf009_suggestion_correct is not null;
