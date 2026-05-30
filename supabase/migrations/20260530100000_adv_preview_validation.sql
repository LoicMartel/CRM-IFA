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
