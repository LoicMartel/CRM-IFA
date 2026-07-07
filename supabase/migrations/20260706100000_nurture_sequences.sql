-- Nurturing + relances no-show — moteur de séquences email (canal Unipile, boîte de Rafi).
-- 3 tables : définition de séquence, étapes (multicanal-ready), enrôlements par lead.
-- Le déclenchement se fait par pg_cron -> POST /api/cron/nurture (logique en TS côté CRM,
-- pas de logique métier en SQL). RLS calquée sur `email_log` : lecture équipe authentifiée,
-- écriture réservée au service_role (bypass RLS).
-- À appliquer via le SQL editor Supabase (token Management expiré côté Teina). Idempotent.

-- 1) Séquences ---------------------------------------------------------------
create table if not exists nurture_sequences (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- 'vsl-nurturing' | 'noshow-r0' | 'noshow-r1' | 'pre-rdv'
  name text not null,
  trigger text not null,                     -- comment un lead y entre
  anchor text not null default 'enrollment', -- 'enrollment' (delai depuis l'enrolment) | 'meeting' (compte a rebours: scheduled_at - delai)
  is_active boolean not null default true,
  from_account_id text,                      -- compte Unipile expéditeur (rafi@) ; null -> fallback env UNIPILE_DEFAULT_EMAIL_ACCOUNT_ID
  created_at timestamptz not null default now()
);

-- 2) Étapes ------------------------------------------------------------------
create table if not exists nurture_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references nurture_sequences(id) on delete cascade,
  step_order int not null,                   -- 1, 2, 3, ...
  delay_hours int not null,                  -- délai depuis l'enrôlement (J+0 = 0, J+1 = 24, ...)
  channel text not null default 'email',     -- 'email' aujourd'hui ; 'whatsapp'/'sms' plus tard (multicanal-ready)
  subject text,                              -- requis pour email ; null pour un canal chat
  body text not null,                        -- template, merge tags {{firstName}}
  created_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

-- 3) Enrôlements -------------------------------------------------------------
create table if not exists nurture_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references nurture_sequences(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  meeting_id uuid references meetings(id) on delete set null,   -- RDV déclencheur (séquences no-show)
  status text not null default 'active',     -- active | completed | exited_booked | exited_replied | cancelled
  current_step int not null default 0,       -- dernière étape envoyée (0 = aucune encore)
  next_send_at timestamptz,                  -- prochaine étape due ; null quand terminé
  enrolled_at timestamptz not null default now(),
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);
-- Un seul enrôlement ACTIF par (séquence, contact) — via index unique PARTIEL (pas de contrainte
-- inline) : les lignes terminées (completed/exited_*) restent, ce qui autorise un RÉ-enrôlement
-- (no-show -> rebook, 2e no-show) tout en empêchant deux séquences actives en parallèle.
create unique index if not exists nurture_enrollments_active_uidx
  on nurture_enrollments (sequence_id, contact_id)
  where status = 'active';

-- Garde-fous de valeurs (idempotents) ----------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'nurture_sequences_trigger_chk') then
    alter table nurture_sequences add constraint nurture_sequences_trigger_chk
      check (trigger in ('optin_vsl', 'no_show_r0', 'no_show_r1', 'booked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nurture_sequences_anchor_chk') then
    alter table nurture_sequences add constraint nurture_sequences_anchor_chk
      check (anchor in ('enrollment', 'meeting'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'nurture_steps_channel_chk') then
    alter table nurture_steps add constraint nurture_steps_channel_chk
      check (channel in ('email', 'whatsapp', 'sms'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nurture_steps_order_chk') then
    alter table nurture_steps add constraint nurture_steps_order_chk check (step_order >= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'nurture_steps_delay_chk') then
    alter table nurture_steps add constraint nurture_steps_delay_chk check (delay_hours >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'nurture_enrollments_status_chk') then
    alter table nurture_enrollments add constraint nurture_enrollments_status_chk
      check (status in ('active', 'completed', 'exited_booked', 'exited_replied', 'cancelled'));
  end if;
end $$;

-- Index ----------------------------------------------------------------------
-- Scan du cron : enrôlements actifs dont l'étape est due.
create index if not exists nurture_enrollments_due_idx
  on nurture_enrollments (next_send_at)
  where status = 'active';
create index if not exists nurture_enrollments_contact_idx on nurture_enrollments (contact_id);
create index if not exists nurture_steps_sequence_idx on nurture_steps (sequence_id, step_order);

-- RLS ------------------------------------------------------------------------
alter table nurture_sequences enable row level security;
alter table nurture_steps enable row level security;
alter table nurture_enrollments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'nurture_sequences' and policyname = 'nurture_sequences_select_authenticated') then
    create policy "nurture_sequences_select_authenticated" on nurture_sequences for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'nurture_steps' and policyname = 'nurture_steps_select_authenticated') then
    create policy "nurture_steps_select_authenticated" on nurture_steps for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'nurture_enrollments' and policyname = 'nurture_enrollments_select_authenticated') then
    create policy "nurture_enrollments_select_authenticated" on nurture_enrollments for select to authenticated using (true);
  end if;
end $$;
