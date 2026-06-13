-- Inbox mailbox triage (chantier C — catégorisation + dispatch de la boîte de Rafi).
-- classifyMailbox poses TWO orthogonal axes in ONE LLM pass (mode='classify' accounts only):
--   triage_folder          = thème (les 10 dossiers du doc Rafi, niveau 1)
--   triage_action_required = dossier "00 À traiter" du doc (flag, orthogonal au thème)
--   triage_assignee        = qui doit traiter (dispatch équipe)
-- *_source ('ai'|'human'): une reclassification manuelle verrouille le champ (l'IA ne réécrit jamais 'human').
--
-- PAS de CHECK sur triage_folder / triage_assignee — VOLONTAIRE : la taxonomie ET le mapping
-- destinataire vivent dans src/lib/inbox/triage-config.ts (source unique, config-driven) et sont
-- validés côté app. La visio Loïc+Rafi peut les éditer SANS migration. Nullable : seul le chemin
-- classify écrit ces colonnes ; les chemins leads (agent) et copilote n'y touchent jamais (zéro régression).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS triage_folder text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS triage_action_required boolean NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS triage_assignee text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS triage_assignee_source text NOT NULL DEFAULT 'ai';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS triage_folder_reason text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS triage_folder_source text NOT NULL DEFAULT 'ai';

-- Filtre de la vue /tri-courrier (par dossier / destinataire) : seules les conversations classées comptent.
CREATE INDEX IF NOT EXISTS conversations_triage_idx ON conversations (triage_folder) WHERE triage_folder IS NOT NULL;

-- RLS : héritée de la table conversations (policy admin existante, 'Admin' = ANY(roles)). Aucune
-- policy à ajouter (RLS = row-level, les nouvelles colonnes sont couvertes par la policy en place).
