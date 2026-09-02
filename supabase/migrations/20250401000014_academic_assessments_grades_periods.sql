-- ============================================================
-- EduTrack :: 0014_academic_assessments_grades_periods.sql
--
-- Phase 5 : évaluations, notes structurées, moyennes, annonces,
-- notifications académiques.
--
--  1. academic_periods   (nouv.) : période (trimestre/semestre/custom).
--  2. assessments        (nouv.) : une évaluation dans une classe +
--     matière + période, portée par un enseignant autorisé.
--  3. grades   (alt.) : ajout assessment_id / published_at / graded_by,
--     unicité par (assessment, student), publication des notes.
--  4. announcements (alt.) : published_at / archived_at (publication +
--     archivage).
--  5. Helpers d'autorisation + triggers d'intégrité inter-écoles.
--  6. RLS : assessments / academic_periods / grades réécrite
--     (parent = notes publiées uniquement, écriture enseignant de la
--     classe + matière autorisée ou admin).
-- ============================================================

-- ============================================================
-- 0. Helper d'autorisation : l'utilisateur enseigne la matière dans la classe
-- ============================================================
create or replace function public.user_teaches_subject_in_class(
  target_class uuid,
  target_subject uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_subjects cs
    join public.teachers t on t.id = cs.teacher_id
    join public.school_members sm
      on sm.user_id = t.user_id and sm.school_id = t.school_id
    where cs.class_id = target_class
      and cs.subject_id = target_subject
      and t.user_id = auth.uid()
      and sm.role = 'TEACHER'
  );
$$;

-- L'utilisateur est-il le correcteur d'une note (enseignant de la
-- classe + matière de l'évaluation) ou un admin de l'école ?
create or replace function public.user_may_grade_assessment(
  target_assessment uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_class uuid;
  v_subject uuid;
begin
  select a.school_id, a.class_id, a.subject_id
    into v_school, v_class, v_subject
  from public.assessments a where a.id = target_assessment;

  if v_school is null then
    return false;
  end if;

  return public.is_admin_of_school(v_school)
      or public.user_teaches_subject_in_class(v_class, v_subject);
end;
$$;

-- ============================================================
-- 1. academic_periods
-- ============================================================
create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name text not null,
  type text not null default 'term' check (type in ('term', 'semester', 'trimester', 'custom')),
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_academic_periods_school on public.academic_periods (school_id);
create index idx_academic_periods_year on public.academic_periods (academic_year_id);
create index idx_academic_periods_current on public.academic_periods (school_id, is_current);

-- ============================================================
-- 2. assessments
-- ============================================================
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  academic_period_id uuid not null references public.academic_periods (id) on delete cascade,
  title text not null,
  description text,
  max_score numeric not null check (max_score > 0),
  coefficient numeric not null default 1 check (coefficient > 0),
  assessment_date date not null default current_date,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_assessments_school on public.assessments (school_id);
create index idx_assessments_class on public.assessments (class_id);
create index idx_assessments_subject on public.assessments (subject_id);
create index idx_assessments_period on public.assessments (academic_period_id);
create index idx_assessments_teacher on public.assessments (teacher_id);

-- ============================================================
-- 3. grades (altération : évaluations, publication, correcteur)
-- ============================================================
alter table public.grades
  add column if not exists assessment_id uuid references public.assessments (id) on delete cascade,
  add column if not exists published_at timestamptz,
  add column if not exists graded_by uuid references public.profiles (id) on delete set null;

-- Une seule note par élève et évaluation (pour les notes liées à une
-- évaluation ; les anciennes lignes sans évaluation restent libres, car dans
-- un index unique classique les NULL sont toujours distincts). Index NON
-- partiel afin que `ON CONFLICT (assessment_id, student_id)` fonctionne.
create unique index if not exists uq_grades_assessment_student
  on public.grades (assessment_id, student_id);

-- Rétro-compatibilité : les notes existantes (sans évaluation) sont
-- considérées publiées afin que les affichages parent/analytics Phase 1-4
-- continuent de fonctionner.
update public.grades g
set published_at = coalesce(g.published_at, now())
where g.published_at is null;

-- ============================================================
-- 4. announcements (altération : publication + archivage)
-- ============================================================
alter table public.announcements
  add column if not exists published_at timestamptz,
  add column if not exists archived_at timestamptz;

-- ============================================================
-- 5. Triggers d'intégrité inter-écoles
-- ============================================================

-- academic_periods : la période appartient à la même école que l'année.
create or replace function public.assert_academic_period_same_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
begin
  select ay.school_id into v_school
  from public.academic_years ay where ay.id = new.academic_year_id;

  if v_school is null then
    raise exception 'Année scolaire introuvable';
  end if;

  if new.school_id is distinct from v_school then
    raise exception 'La période référence une année scolaire d''une autre école';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_academic_period_same_school on public.academic_periods;
create trigger trg_academic_period_same_school
  before insert or update on public.academic_periods
  for each row execute function public.assert_academic_period_same_school();

-- assessments : classe, matière, enseignant et période de la même école,
-- et l'enseignant est autorisé pour cette matière dans cette classe.
create or replace function public.assert_assessment_same_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_school uuid;
  v_subject_school uuid;
  v_teacher_school uuid;
  v_period_school uuid;
  v_authorized boolean;
begin
  select school_id into v_class_school from public.classes c where c.id = new.class_id;
  select school_id into v_subject_school from public.subjects s where s.id = new.subject_id;
  select school_id into v_teacher_school from public.teachers t where t.id = new.teacher_id;
  select ay.school_id into v_period_school
    from public.academic_periods ap
    join public.academic_years ay on ay.id = ap.academic_year_id
    where ap.id = new.academic_period_id;

  if v_class_school is null or v_subject_school is null
     or v_teacher_school is null or v_period_school is null then
    raise exception 'Référence scolaire introuvable';
  end if;

  if new.school_id is distinct from v_class_school
     or new.school_id is distinct from v_subject_school
     or new.school_id is distinct from v_teacher_school
     or new.school_id is distinct from v_period_school then
    raise exception 'L''évaluation mêle des entités d''écoles différentes';
  end if;

  select exists (
    select 1 from public.class_subjects cs
    where cs.class_id = new.class_id
      and cs.subject_id = new.subject_id
      and cs.teacher_id = new.teacher_id
  ) into v_authorized;

  if not v_authorized then
    raise exception 'L''enseignant n''est pas autorisé pour cette matière dans cette classe';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assessment_same_school on public.assessments;
create trigger trg_assessment_same_school
  before insert or update on public.assessments
  for each row execute function public.assert_assessment_same_school();

-- grades : la note concerne un élève de la classe de l'évaluation,
-- dans la même école.
create or replace function public.assert_grade_same_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_school uuid;
  v_student_class uuid;
  v_assessment_school uuid;
  v_assessment_class uuid;
  v_assessment_max numeric;
begin
  select st.school_id, st.classroom_id into v_student_school, v_student_class
  from public.students st where st.id = new.student_id;

  if new.assessment_id is not null then
    select a.school_id, a.class_id, a.max_score
      into v_assessment_school, v_assessment_class, v_assessment_max
    from public.assessments a where a.id = new.assessment_id;

    if v_assessment_school is null then
      raise exception 'Évaluation introuvable';
    end if;

    if v_student_school is distinct from v_assessment_school then
      raise exception 'La note référence une école différente de celle de l''élève';
    end if;

    if v_student_class is distinct from v_assessment_class then
      raise exception 'L''élève n''est pas dans la classe de l''évaluation';
    end if;

    if new.score > v_assessment_max then
      raise exception 'La note dépasse le maximum de l''évaluation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_grade_same_school on public.grades;
create trigger trg_grade_same_school
  before insert or update on public.grades
  for each row execute function public.assert_grade_same_school();

-- ============================================================
-- 6. RLS
-- ============================================================
alter table public.academic_periods enable row level security;
alter table public.assessments enable row level security;

-- ---- academic_periods ----
-- SELECT : super-admin, admin/enseignant de l'école, ou parent ayant un
--   enfant dans l'école (pour interpréter les périodes).
create policy "academic_periods_select" on public.academic_periods
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_school_non_parent_member(auth.uid(), school_id)
    or exists (
      select 1 from public.parents p
      join public.student_parents sp on sp.parent_id = p.id
      join public.students st on st.id = sp.student_id
      where p.user_id = auth.uid() and st.school_id = academic_periods.school_id
    )
  );

-- INSERT/UPDATE/DELETE : admin de l'école uniquement.
create policy "academic_periods_admin_write" on public.academic_periods
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ---- assessments ----
-- SELECT : super-admin, admin de l'école, enseignant autorisé, ou parent
--   ayant un enfant dans la classe (uniquement si l'évaluation est publiée).
create policy "assessments_select" on public.assessments
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of_school(school_id)
    or public.user_teaches_subject_in_class(class_id, subject_id)
    or (
      published
      and exists (
        select 1 from public.parents p
        join public.student_parents sp on sp.parent_id = p.id
        join public.students st on st.id = sp.student_id
        where p.user_id = auth.uid()
          and st.school_id = assessments.school_id
          and st.classroom_id = assessments.class_id
      )
    )
  );

-- INSERT/UPDATE/DELETE : admin de l'école ou enseignant autorisé de la
--   classe+matière de l'évaluation (via le trigger aidant à l'autorisation).
create policy "assessments_admin_teacher_write" on public.assessments
  for all to authenticated
  using (
    public.is_admin_of_school(school_id)
    or public.user_teaches_subject_in_class(class_id, subject_id)
  )
  with check (
    public.is_admin_of_school(school_id)
    or public.user_teaches_subject_in_class(class_id, subject_id)
  );

-- ---- grades (réécriture) ----
-- SELECT : super-admin, admin/enseignant de l'école (note visible quel que
--   soit l'état de publication pour le staff), et parent de l'élève pour les
--   notes publiées uniquement.
drop policy if exists "grades_select" on public.grades;
drop policy if exists "grades_write" on public.grades;

create policy "grades_select" on public.grades
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_school_non_parent_member(auth.uid(), school_id)
    or (
      public.parent_of_student(student_id)
      and published_at is not null
    )
  );

-- INSERT/UPDATE/DELETE : admin de l'école de l'élève, ou enseignant autorisé
--   sur l'évaluation (classe + matière). Le triggered garde l'intégrité.
create policy "grades_write" on public.grades
  for all to authenticated
  using (
    exists (
      select 1 from public.students st
      where st.id = grades.student_id
        and public.is_admin_of_school(st.school_id)
    )
    or (grades.assessment_id is not null
        and public.user_may_grade_assessment(grades.assessment_id))
  )
  with check (
    exists (
      select 1 from public.students st
      where st.id = grades.student_id
        and public.is_admin_of_school(st.school_id)
    )
    or (grades.assessment_id is not null
        and public.user_may_grade_assessment(grades.assessment_id))
  );

-- ---- announcements : on restreint la lecture/écriture aux publiées /
--    archivées gérées par l'admin. Publication = published_at renseigné.
drop policy if exists "announcements_select" on public.announcements;
drop policy if exists "announcements_admin_write" on public.announcements;

create policy "announcements_select" on public.announcements
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_school_non_parent_member(auth.uid(), school_id)
    )
    or (
      published_at is not null and archived_at is null
      and (
        audience = 'all'
        or (
          audience = 'class'
          and exists (
            select 1
            from public.student_parents sp
            join public.students s on s.id = sp.student_id
            join public.parents p on p.id = sp.parent_id
            where s.classroom_id = announcements.classroom_id
              and p.user_id = auth.uid()
          )
        )
      )
    )
  );

create policy "announcements_admin_write" on public.announcements
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- 7. Post-publication : volume notifications académiques pris en charge
--    par les server actions (publication + idempotence) — voir
--    docs/GRADES.md, docs/ANNOUNCEMENTS.md.
-- ============================================================