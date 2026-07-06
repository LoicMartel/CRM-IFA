-- ═══════════════════════════════════════════════════════════════════════════
-- SETUP pg_cron du moteur de nurturing (À EXÉCUTER AU GO-LIVE, PAS une migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ce fichier N'EST PAS dans supabase/migrations/ : il ne doit PAS être appliqué
-- automatiquement. On le lance à la main dans le SQL editor Supabase UNE FOIS que :
--   1. l'endpoint /api/cron/nurture est déployé (Vercel) ;
--   2. les env sont posées côté CRM : CRON_SECRET, UNIPILE_DSN/API_KEY (api23),
--      UNIPILE_NURTURE_ACCOUNT_ID (= compte Unipile de rafi@), NURTURE_BOOKING_URL,
--      NURTURE_VSL_URL, NURTURE_INTERVIEW_URL.
-- Le scheduler vit côté Supabase (indépendant de l'accès Vercel). L'endpoint applique
-- lui-même la fenêtre d'envoi (9h-19h, lun-ven, heure de Paris) -> on planifie un simple
-- tick horaire. pg_net est fire-and-forget ; l'endpoint est idempotent (rejeu sans risque).

-- 1) Extensions (idempotent) -------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Secret d'appel dans Vault (À FAIRE UNE FOIS avec la vraie valeur de CRON_SECRET)
--    select vault.create_secret('<CRON_SECRET_VALUE>', 'nurture_cron_secret');

-- 3) Planifier le tick horaire. Remplacer l'URL par le domaine prod réel si différent.
--    select cron.schedule(
--      'nurture-hourly',
--      '0 * * * *',
--      $$
--      select net.http_get(
--        url := 'https://crm-lca.vercel.app/api/cron/nurture',
--        headers := jsonb_build_object(
--          'Authorization',
--          'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'nurture_cron_secret')
--        )
--      );
--      $$
--    );

-- Vérifier : select * from cron.job where jobname = 'nurture-hourly';
-- Historique : select * from cron.job_run_details order by start_time desc limit 20;

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
--    select cron.unschedule('nurture-hourly');

-- ── BONUS (dette existante) : le même mécanisme peut remplacer le "scheduler externe"
--    attendu par /api/cron/inbox-agent-followup et /api/cron/inbox-digest (crons hors
--    vercel.json). Ajouter 2 jobs cron.schedule pointant sur ces URLs avec le même secret
--    -> rend inutile un upgrade Vercel Pro pour les crons inbox.
