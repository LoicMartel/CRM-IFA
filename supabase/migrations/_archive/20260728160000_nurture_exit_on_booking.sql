-- Sortie automatique des séquences de RELANCE quand un RDV est (re)pris.
--
-- Incident 28/07/2026 (Céline HADJADJ) : no-show le 16/07 -> enrôlée dans 'noshow-r0' par
-- trg_enroll_noshow_nurture. RDV de rattrapage repris le 20/07 DEPUIS LE CRM (UI commercial), donc
-- sans passer par /api/booking/confirm — le seul endroit qui appelait exitEnrollments('exited_booked').
-- L'enrôlement est resté actif et l'étape 3 « Je clôture votre dossier ? » est partie le 21/07 vers
-- une prospecte qui avait un RDV calé pour le 30/07.
--
-- Les RDV s'écrivent depuis 6 chemins différents (UI contact-detail, meetings-view, agenda, reports,
-- assistant, routes booking) : brancher le hook côté application est structurellement fragile. On
-- pose donc la garantie en base, en miroir de trg_enroll_noshow_nurture (même pattern : trigger
-- SECURITY DEFINER + bloc EXCEPTION non-bloquant pour ne JAMAIS faire échouer la prise de RDV).
--
-- Seules les séquences anchor='enrollment' (relance : vsl-nurturing, noshow-r0, noshow-r1) sont
-- coupées. La séquence 'pre-rdv' (anchor='meeting') doit au contraire continuer : c'est elle qui
-- prépare le RDV qu'on vient de poser.
--
-- À appliquer via le SQL editor Supabase. Idempotent.

create or replace function exit_nurture_on_booking() returns trigger as $$
declare
  v_relevant boolean;
begin
  -- Sur INSERT il n'y a pas de OLD : on traite toute création de RDV à venir. Sur UPDATE, on ne
  -- réagit qu'aux transitions utiles (statut ou date), pas à chaque édition de notes.
  if tg_op = 'INSERT' then
    v_relevant := true;
  else
    v_relevant := (old.status is distinct from new.status)
               or (old.scheduled_at is distinct from new.scheduled_at)
               or (old.contact_id is distinct from new.contact_id);
  end if;

  if v_relevant
     and new.contact_id is not null
     and new.status = 'booked'
     and new.scheduled_at > now() then
    begin
      update nurture_enrollments e
         set status = 'exited_booked',
             next_send_at = null
       where e.contact_id = new.contact_id
         and e.status = 'active'
         and e.sequence_id in (select id from nurture_sequences where anchor <> 'meeting');
    exception
      when others then
        raise warning 'exit_nurture_on_booking (non-blocking): %', sqlerrm;
    end;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_exit_nurture_on_booking on meetings;
create trigger trg_exit_nurture_on_booking
  after insert or update on meetings
  for each row execute function exit_nurture_on_booking();

-- Rattrapage : coupe les relances actives des contacts qui ont DÉJÀ un RDV à venir.
update nurture_enrollments e
   set status = 'exited_booked', next_send_at = null
 where e.status = 'active'
   and e.sequence_id in (select id from nurture_sequences where anchor <> 'meeting')
   and exists (
     select 1 from meetings m
      where m.contact_id = e.contact_id
        and m.status = 'booked'
        and m.scheduled_at > now()
   );
