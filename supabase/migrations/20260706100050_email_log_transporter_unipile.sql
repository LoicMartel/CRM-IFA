-- Autorise le transporteur 'unipile' dans email_log (nurturing + relances no-show partent
-- de la boîte de Rafi via Unipile, pas Resend). Même piège que pennylane/firma : sans ça, le
-- CHECK rejette l'insert EN SILENCE (logEmail non bloquant) -> aucune trace Qualiopi.
-- Drop + recreate avec le jeu complet (idempotent, tolère l'état repo 'resend/ionos' comme
-- l'état prod déjà étendu 'resend/ionos/pennylane/firma').
-- À appliquer via le SQL editor Supabase. Idempotent.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'email_log_transporter_chk') then
    alter table email_log drop constraint email_log_transporter_chk;
  end if;
  alter table email_log add constraint email_log_transporter_chk
    check (transporter in ('resend', 'ionos', 'pennylane', 'firma', 'unipile'));
end $$;
