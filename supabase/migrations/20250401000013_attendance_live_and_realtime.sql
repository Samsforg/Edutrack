-- ============================================================
-- EduTrack :: 0013_attendance_live_and_realtime.sql
--
-- Phase 4 : présence, absences, retards, temps réel.
--  1. Colonnes horaires check_in / check_out + audit updated_by.
--  2. Trigger d'intégrité inter-écoles sur `attendance`
--     (school_id = student.school_id, classroom_id = student.classroom_id).
--  3. Index composés manquants (classroom_id+date, student_id+date).
--  4. Activation Realtime (Postgres Changes) sur `attendance` et
--     `notifications`.
-- ============================================================

-- 1. Colonnes horaires + audit
alter table public.attendance
  add column if not exists check_in timestamptz,
  add column if not exists check_out timestamptz,
  add column if not exists updated_by uuid references public.profiles (id) on delete set null;

comment on column public.attendance.check_in is
  'Heure d''arrivée (facultatif). Pertinent en cas de retard.';
comment on column public.attendance.check_out is
  'Heure de départ (facultatif).';
comment on column public.attendance.taken_by is
  'Utilisateur qui a enregistré la présence (created_by).';
comment on column public.attendance.updated_by is
  'Utilisateur ayant modifié la présence en dernier (audit).';

-- 2. Intégrité inter-écoles :
--    l'école et la classe doivent correspondre à celles de l'élève.
--    On ne fait jamais confiance au school_id/class_id du client.
create or replace function public.assert_attendance_same_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_school uuid;
  v_student_class uuid;
begin
  select st.school_id, st.classroom_id into v_student_school, v_student_class
  from public.students st where st.id = new.student_id;

  if v_student_school is null then
    raise exception 'Élève introuvable';
  end if;

  if new.school_id is distinct from v_student_school then
    raise exception 'L''appel référence une école différente de celle de l''élève';
  end if;

  if new.classroom_id is not null and new.classroom_id is distinct from v_student_class then
    raise exception 'L''appel référence une classe différente de celle de l''élève';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_attendance_same_school on public.attendance;
create trigger trg_attendance_same_school
  before insert or update on public.attendance
  for each row execute function public.assert_attendance_same_school();

-- 3. Index composés manquants pour l'appel du jour, l'historique d'un
--    élève et les statistiques d'une classe (complément des index de 0001).
create index if not exists idx_attendance_class_date
  on public.attendance (classroom_id, attendance_date);
create index if not exists idx_attendance_student_date
  on public.attendance (student_id, attendance_date);

-- 4. Realtime (Postgres Changes) sur attendance + notifications.
--    Idempotent : on n'ajoute une table que si absente de la publication.
do $$
declare
  v_att regclass := to_regclass('public.attendance');
  v_not regclass := to_regclass('public.notifications');
begin
  if v_att is not null and not exists (
    select 1 from pg_publication_rel r
    join pg_publication p on p.oid = r.prpubid
    where p.pubname = 'supabase_realtime' and r.prrelid = v_att
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;

  if v_not is not null and not exists (
    select 1 from pg_publication_rel r
    join pg_publication p on p.oid = r.prpubid
    where p.pubname = 'supabase_realtime' and r.prrelid = v_not
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;