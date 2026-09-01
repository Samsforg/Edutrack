-- ============================================================
-- EduTrack :: 0002_helpers.sql
-- Multi-tenancy + authorization helper functions used by RLS.
-- MUST run after 0001_tables.sql: PostgreSQL validates SQL
-- functions at creation time, so they cannot reference tables
-- that do not exist yet.
-- ============================================================

-- Returns true when the given user is an active member of the given school.
create or replace function public.is_school_member(target_user uuid, target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_members sm
    where sm.user_id = target_user
      and sm.school_id = target_school
  );
$$;

-- Returns true when the given user holds a specific role in the given school.
create or replace function public.user_has_role(target_school uuid, required_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_members sm
    where sm.user_id = auth.uid()
      and sm.school_id = target_school
      and sm.role = required_role
  );
$$;

-- Returns true when the current user is a SUPER_ADMIN (platform).
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.school_members sm
    where sm.user_id = auth.uid()
      and sm.role = 'SUPER_ADMIN'
  );
$$;

-- Returns true when the given student belongs to the given school.
create or replace function public.student_in_school(target_student uuid, target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = target_student and s.school_id = target_school
  );
$$;

-- Returns true when the current user (parent) is linked to the given student.
-- The parent row is bound to auth.uid(): a parent can only resolve a
-- student through their OWN parents row (never everyone's children).
create or replace function public.parent_of_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parents p
    join public.student_parents sp on sp.parent_id = p.id
    where sp.student_id = target_student
      and p.user_id = auth.uid()
  );
$$;

-- True when the current authenticated user teaches the given class.
create or replace function public.user_teaches_class(target_class uuid)
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
    join public.school_members sm on sm.user_id = t.user_id and sm.school_id = t.school_id
    where cs.class_id = target_class
      and t.user_id = auth.uid()
      and sm.role = 'TEACHER'
  );
$$;

-- True when the current user is SCHOOL_ADMIN of a school that
-- owns the given object's school relation.
create or replace function public.is_admin_of_school(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_role(target_school, 'SCHOOL_ADMIN');
$$;