-- T8 — tracking de l'envoi email facture, pour le retry par le cron pennylane-sync.
-- T5 facture l'échéance puis tente send_by_email 1 fois (timeout Vercel Hobby).
-- Si le PDF Pennylane n'est pas prêt (409), invoice_email_sent reste false et le
-- cron réessaie jusqu'à succès.

ALTER TABLE billing_months
  ADD COLUMN IF NOT EXISTS invoice_email_sent boolean DEFAULT false;
