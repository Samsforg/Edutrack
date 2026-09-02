-- ============================================================
-- EduTrack :: 0009_school_management.sql
-- Gestion de l'établissement et du référentiel scolaire.
--  - student_status enum + students.status + index
--  - colonnes contact de l'école (email, phone, address, city, country)
--  - academic_years: is_active -> is_current + contrainte "une seule
--    année courante par école" (index unique partiel)
--  - subjects.code unique par école (index unique partiel)
--  - teachers.is_active (activation / désactivation)
--  - triggers d'intégrité cross-école sur les relations indirectes
--  - index de recherche / pagination
-- ============================================================

-- ============================================================
-- 1. Cycle de vie des élèves
-- ============================================================

do $$ begin
  create type public.student_status as enum (
    'active', 'inactive', 'graduated', 'transferred'
  );
exception when duplicate_object then null; end $$;

alter table public.students
  add column if not exists status public.student_status not null default 'active';

create index if not exists idx_students_school_status
  on public.students (school_id, status);

-- Recherche par nom (pagination / filtre texte).
create index if not exists idx_students_school_lastname
  on public.students (school_id, last_name);

-- ============================================================
-- 2. Coordonnées de l'établissement
-- ============================================================

alter table public.schools
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists country text;

-- ============================================================
-- 3. Années scolaires : une seule année courante par école.
-- ============================================================

-- Renomme is_active -> is_current pour refléter la sémantique métier
-- (une année est "courante", pas simplement "active").
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'academic_years'
      and column_name = 'is_active'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'academic_years'
      and column_name = 'is_current'
  ) then
    alter table public.academic_years rename column is_active to is_current;
  end if;
end $$;

-- Garantit qu'une seule année est courante par école.
create unique index if not exists idx_academic_years_single_current
  on public.academic_years (school_id) where is_current;

create index if not exists idx_academic_years_school_current
  on public.academic_years (school_id, is_current);

-- ============================================================
-- 4. Matières : code unique au sein de chaque école.
-- ============================================================

-- Backfill déterministe pour les données existantes (code nullable).
with numbered as (
  select id, school_id,
         row_number() over (partition by school_id order by name) as rn
  from public.subjects
  where code is null
)
update public.subjects s
set code = 'S' || lpad(numbered.rn::text, 3, '0')
from numbered
where numbered.id = s.id;

create unique index if not exists idx_subjects_school_code_unique
  on public.subjects (school_id, code) where code is not null;

-- ============================================================
-- 5. Enseignants : activation / désactivation.
-- ============================================================

alter table public.teachers
  add column if not exists is_active boolean not null default true;

create index if not exists idx_teachers_school_active
  on public.teachers (school_id, is_active);

-- ============================================================
-- 6. Intégrité cross-école sur les relations indirectes.
--
-- Les policies RLS bloquent l'accès *direct* aux données d'une autre
-- école. Ces triggers bloquent les associations *indirectes* (écrites
-- légitimes sur la propre école qui référencent des objets d'une autre
-- école). Ils s'exécutent en security definer pour lire les lignes
-- référencées sans être gênés par RLS.
-- ============================================================

-- 6a. classes.academic_year_id doit appartenir à la même école.
create or replace function public.assert_class_year_same_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.academic_year_id is not null
     and not exists (
       select 1 from public.academic_years ay
       where ay.id = new.academic_year_id
         and ay.school_id = new.school_id
     ) then
    raise exception 'La classe référence une année scolaire d''une autre école';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_class_year_same_school on public.classes;
create trigger trg_class_year_same_school
  before insert or update on public.classes
  for each row execute function public.assert_class_year_same_school();

-- 6b. class_subjects : classe, matière et enseignant de la même école.
create or replace function public.assert_class_subject_same_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_school uuid;
  v_subject_school uuid;
  v_teacher_school uuid;
begin
  select c.school_id into v_class_school
  from public.classes c where c.id = new.class_id;

  if v_class_school is null then
    raise exception 'Classe introuvable';
  end if;

  select s.school_id into v_subject_school
  from public.subjects s where s.id = new.subject_id;

  if v_subject_school is distinct from v_class_school then
    raise exception 'La matière assignée appartient à une autre école';
  end if;

  if new.teacher_id is not null then
    select t.school_id into v_teacher_school
    from public.teachers t where t.id = new.teacher_id;

    if v_teacher_school is distinct from v_class_school then
      raise exception 'L''enseignant assigné appartient à une autre école';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_class_subject_same_school on public.class_subjects;
create trigger trg_class_subject_same_school
  before insert or update on public.class_subjects
  for each row execute function public.assert_class_subject_same_school();

-- 6c. students : classe et année scolaire de la même école.
create or replace function public.assert_student_class_same_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_school uuid;
  v_year_school uuid;
begin
  if new.classroom_id is not null then
    select c.school_id into v_class_school
    from public.classes c where c.id = new.classroom_id;

    if v_class_school is distinct from new.school_id then
      raise exception 'L''élève est rattaché à une classe d''une autre école';
    end if;
  end if;

  if new.academic_year_id is not null then
    select ay.school_id into v_year_school
    from public.academic_years ay where ay.id = new.academic_year_id;

    if v_year_school is distinct from new.school_id then
      raise exception 'L''élève référence une année scolaire d''une autre école';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_student_class_same_school on public.students;
create trigger trg_student_class_same_school
  before insert or update on public.students
  for each row execute function public.assert_student_class_same_school();

-- 6d. student_parents : élève et parent de la même école.
create or replace function public.assert_student_parent_same_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_school uuid;
  v_parent_school uuid;
begin
  select st.school_id into v_student_school
  from public.students st where st.id = new.student_id;

  if v_student_school is null then
    raise exception 'Élève introuvable';
  end if;

  select p.school_id into v_parent_school
  from public.parents p where p.id = new.parent_id;

  if v_parent_school is distinct from v_student_school then
    raise exception 'Le parent appartient à une autre école';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_student_parent_same_school on public.student_parents;
create trigger trg_student_parent_same_school
  before insert or update on public.student_parents
  for each row execute function public.assert_student_parent_same_school();

-- ============================================================
-- 7. Index de recherche / filtres
-- ============================================================

create index if not exists idx_classes_school_year
  on public.classes (school_id, academic_year_id);