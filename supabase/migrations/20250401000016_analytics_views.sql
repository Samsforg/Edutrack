-- EduTrack :: 0016_analytics_views.sql
-- Vue SQL optimisées pour les statistiques (Phase 6).
-- security_invoker = true : la vue obéit aux RLS des tables sous-jacentes.
-- Chaque vue est en plus restreinte aux administrateurs de l'école via
-- is_admin_of_school(...) (security definer) : seule une personne
-- SCHOOL_ADMIN de l'établissement peut lire les statistiques agrégées.

-- ── 1. Assiduité globale par classe ────────────────────────
create or replace view public.class_attendance_stats
  with (security_invoker = true)
as
select
  a.school_id,
  a.classroom_id                        as class_id,
  c.name                                as class_name,
  count(*)                              as recorded,
  count(*) filter (where a.status = 'present') as present,
  count(*) filter (where a.status = 'absent')  as absent,
  count(*) filter (where a.status = 'late')    as late,
  count(*) filter (where a.status = 'excused') as excused
from public.attendance a
join public.classes c on c.id = a.classroom_id
where public.is_admin_of_school(a.school_id)
group by a.school_id, a.classroom_id, c.name;

comment on view public.class_attendance_stats is
  'Statistiques d''assiduité agrégées par classe (admin de l''école uniquement).';

-- ── 2. Assiduité nominative (élève) ────────────────────────
create or replace view public.student_attendance_stats
  with (security_invoker = true)
as
select
  a.school_id,
  a.student_id,
  st.first_name,
  st.last_name,
  a.classroom_id as class_id,
  count(*)                                     as recorded,
  count(*) filter (where a.status = 'present') as present,
  count(*) filter (where a.status = 'absent')  as absent,
  count(*) filter (where a.status = 'late')    as late,
  count(*) filter (where a.status = 'excused') as excused
from public.attendance a
join public.students st on st.id = a.student_id
where public.is_admin_of_school(a.school_id)
group by a.school_id, a.student_id, st.first_name, st.last_name, a.classroom_id;

comment on view public.student_attendance_stats is
  'Assiduité agrégée par élève (admin de l''école uniquement).';

-- ── 3. Statistiques des notes par matière ──────────────────
create or replace view public.school_grade_stats
  with (security_invoker = true)
as
select
  g.school_id,
  g.subject_id,
  s.name          as subject_name,
  g.classroom_id  as class_id,
  c.name          as class_name,
  count(*)                                              as grade_count,
  count(distinct g.student_id)                          as student_count,
  avg(g.score)                                          as avg_score,
  avg(g.score::numeric / nullif(g.max_score,0) * 100)   as avg_norm
from public.grades g
join public.subjects s on s.id = g.subject_id
left join public.classes c on c.id = g.classroom_id
where public.is_admin_of_school(g.school_id)
group by g.school_id, g.subject_id, s.name, g.classroom_id, c.name;

comment on view public.school_grade_stats is
  'Statistiques de notes par matière/classe (admin de l''école uniquement).';

-- ── 4. KPI agrégés par école ───────────────────────────────
create or replace view public.school_kpis
  with (security_invoker = true)
as
select
  schools.id as school_id,
  (select count(*) from public.students st where st.school_id = schools.id and st.status = 'active') as student_count,
  (select count(*) from public.classes cl where cl.school_id = schools.id)                          as class_count,
  (select count(*) from public.teachers t where t.school_id = schools.id and t.is_active)            as teacher_count,
  (select count(*) from public.students st join public.student_parents sp on sp.student_id = st.id
     join public.parents p on p.id = sp.parent_id and p.user_id is not null
     where st.school_id = schools.id)                                                                as linked_parent_count
from public.schools
where public.is_admin_of_school(schools.id);

comment on view public.school_kpis is
  'Effectifs par école (admin de l''école uniquement). Les parents "connectés" sont liés à un compte (user_id non nul).';
