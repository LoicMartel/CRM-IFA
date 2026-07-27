-- Planificateur de facturation : gate convention OPCO.
-- billing_months.status accepte déjà du texte libre (pas de CHECK) → 'planifie' et
-- 'a_valider' ne nécessitent aucune migration de contrainte. Seule nouveauté en base :
-- le signal "convention signée" lu par le cron pour gater l'auto-facturation OPCO.
-- Renseigné par le sous-projet 2 (génération convention) au webhook signature Firma.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS convention_signed_at timestamptz;

-- Le cron scanne les échéances planifiées dues : (status, month).
CREATE INDEX IF NOT EXISTS billing_months_planifie_due_idx
  ON billing_months (status, month)
  WHERE status = 'planifie';
