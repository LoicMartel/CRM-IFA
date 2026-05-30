-- supabase/migrations/20260530100000_adv_preview_validation.sql
-- Trust gate ADV : statut convention "à valider/envoyée" + index inbox.

alter table deals
  add column if not exists convention_status text;

comment on column deals.convention_status is
  'Trust gate ADV : null | to_validate | sent. Signé = convention_signed_at non-null.';

-- Inbox /a-valider : deals en attente de validation (devis ou convention).
create index if not exists idx_deals_adv_to_validate
  on deals (stage, convention_status)
  where stage = 'quote_to_validate' or convention_status = 'to_validate';

-- Nouveau stage devis "préparé, à valider" (avant quote_sent) : étendre la
-- contrainte deals_stage_check (sinon prepareDealQuote ne peut pas passer le deal
-- en quote_to_validate — bug attrapé en E2E 30/05). Valeurs existantes préservées.
alter table deals drop constraint if exists deals_stage_check;
alter table deals add constraint deals_stage_check check (
  stage = any (array[
    'opportunities', 'quote_to_send', 'quote_to_validate', 'quote_sent',
    'opco_deposit', 'quote_signed', 'ordered', 'closed_won', 'closed_lost'
  ]::text[])
);
