-- T5/T8 — tracking facturation sur billing_months (port ADV intra-CRM).
--
-- billing_months ne portait que id/billing_entry_id/month/amount/status/notes.
-- Pour facturer une échéance via Pennylane direct (T5) puis détecter le paiement
-- et réessayer l'email (cron pennylane-sync, T8), on ajoute :
--   - pennylane_invoice_id : id de l'invoice Pennylane émise pour cette échéance
--   - deal_id              : snapshot du deal facturé (le lien canonique est
--                            billing_entries.deal_id ; on le dénormalise ici car
--                            c'est un fait historique immuable et le cron lit
--                            billing_months.deal_id sans join)
--   - invoice_email_sent   : false tant que send_by_email n'a pas réussi (le PDF
--                            Pennylane prend 1-5 min → 409 au 1er essai). Le cron
--                            réessaie jusqu'à succès.
--
-- Additive only — aucune donnée existante touchée.

ALTER TABLE billing_months
  ADD COLUMN IF NOT EXISTS pennylane_invoice_id text,
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_email_sent boolean NOT NULL DEFAULT false;

-- Le cron retry filtre sur (status, invoice_email_sent) avec pennylane_invoice_id non nul.
CREATE INDEX IF NOT EXISTS billing_months_invoice_retry_idx
  ON billing_months (status, invoice_email_sent)
  WHERE pennylane_invoice_id IS NOT NULL;
