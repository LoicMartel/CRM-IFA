-- Enrôlement automatique dans la séquence de relance no-show quand un RDV passe 'no_show'.
-- Le statut no_show est écrit CÔTÉ CLIENT (supabase.from('meetings').update depuis l'UI commercial),
-- donc pas de route serveur où brancher un hook -> trigger Postgres (catch tous les writes ;
-- cohérent avec le pattern "logique métier en triggers" du CRM).
-- R1 (lead chaud) si le contact a déjà un RDV honoré ('done') par ailleurs, sinon R0 (lead froid).
-- Idempotent via unique(sequence_id, contact_id). SECURITY DEFINER pour insérer malgré la RLS.
-- À appliquer via le SQL editor Supabase. Idempotent.

create or replace function enroll_noshow_nurture() returns trigger as $$
declare
  v_slug text;
  v_seq_id uuid;
  v_done_count int;
begin
  if new.status = 'no_show'
     and (old.status is distinct from 'no_show')
     and new.contact_id is not null then

    select count(*) into v_done_count
      from meetings
      where contact_id = new.contact_id and status = 'done' and id <> new.id;

    v_slug := case when v_done_count > 0 then 'noshow-r1' else 'noshow-r0' end;

    select id into v_seq_id from nurture_sequences where slug = v_slug and is_active;
    if v_seq_id is not null then
      insert into nurture_enrollments (sequence_id, contact_id, meeting_id, status, current_step, next_send_at)
      values (v_seq_id, new.contact_id, new.id, 'active', 0, now())
      on conflict (sequence_id, contact_id) do nothing;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_enroll_noshow_nurture on meetings;
create trigger trg_enroll_noshow_nurture
  after update on meetings
  for each row execute function enroll_noshow_nurture();
