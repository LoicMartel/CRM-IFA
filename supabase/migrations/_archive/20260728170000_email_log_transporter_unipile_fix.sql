-- Corrige 20260706100050_email_log_transporter_unipile.sql, qui n'a jamais eu d'effet.
--
-- Cette migration-là droppait `email_log_transporter_chk`. La contrainte réellement posée en prod
-- s'appelle `email_log_transporter_check`. Le `if exists` ne matchait donc rien : le DROP était un
-- no-op et l'ADD créait une SECONDE contrainte à côté de l'ancienne, qui continuait de rejeter
-- 'unipile'. Le SQL s'exécutait sans erreur — d'où le piège : appliqué, et pourtant sans effet.
--
-- Conséquence observée le 28/07 : 1256 emails journalisés, ZÉRO envoi de nurturing. logEmail est
-- non bloquant par conception (un échec de log ne doit jamais empêcher un envoi), donc le rejet
-- passait en console.warn invisible. Les relances automatiques partaient sans laisser aucune trace,
-- ni dans le journal ni sur la fiche du prospect.
--
-- On drope ici TOUTE contrainte CHECK portant sur `transporter`, quel que soit son nom, avant d'en
-- reposer une seule. À appliquer via le SQL editor Supabase. Idempotent.

do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
     where rel.relname = 'email_log'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%transporter%'
  loop
    execute format('alter table email_log drop constraint %I', c.conname);
  end loop;

  alter table email_log add constraint email_log_transporter_chk
    check (transporter in ('resend', 'ionos', 'pennylane', 'firma', 'unipile'));
end $$;
