-- Journal d'audit des emails sortants (preuve Qualiopi / client).
-- Source de vérité opposable : chaque envoi transactionnel du CRM y est journalisé,
-- quel que soit le transporteur. Écriture via service_role (bypass RLS) ; lecture
-- partagée équipe authentifiée (modèle identique à `engagements`).
-- À appliquer via le SQL editor Supabase (token Management expiré côté Teina). Idempotent.

create table if not exists email_log (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subject text,
  body text,
  transporter text not null default 'resend',
  status text not null,
  error text,
  has_attachments boolean not null default false,
  attachment_count int not null default 0,
  related_entity_type text,
  related_entity_id text,
  source text,
  created_at timestamptz not null default now()
);

-- Garde-fous de valeurs (idempotents)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_log_transporter_chk') then
    alter table email_log add constraint email_log_transporter_chk check (transporter in ('resend', 'ionos'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'email_log_status_chk') then
    alter table email_log add constraint email_log_status_chk check (status in ('sent', 'failed'));
  end if;
end $$;

create index if not exists email_log_created_at_idx on email_log (created_at desc);
create index if not exists email_log_recipient_idx on email_log (recipient);
create index if not exists email_log_related_entity_idx on email_log (related_entity_id);

-- RLS : lecture partagée équipe authentifiée ; écriture réservée au service_role (bypass RLS).
alter table email_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'email_log' and policyname = 'email_log_select_authenticated'
  ) then
    create policy "email_log_select_authenticated" on email_log
      for select to authenticated using (true);
  end if;
end $$;
