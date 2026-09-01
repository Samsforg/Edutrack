-- ============================================================
-- EduTrack :: 0001_init.sql
-- Extensions, enums, helper functions and base tables.
-- ============================================================

-- UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================

create type public.user_role as enum ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT');
create type public.school_status as enum ('active', 'suspended', 'archived');
create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
create type public.notification_type as enum ('attendance', 'grade', 'announcement', 'system');
create type public.link_request_status as enum ('pending', 'approved', 'rejected', 'expired');
create type public.announcement_audience as enum ('all', 'class');

-- ============================================================
-- Helper: refresh updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Multi-tenancy helper functions (used by RLS)
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
    where p.school_id in (
      select school_id from public.school_members where user_id = auth.uid() and role = 'PARENT'
    )
      and sp.student_id = target_student
  )
     or exists (
    select 1
    from public.parents p
    join public.student_parents sp on sp.parent_id = p.id
    where p.user_id = auth.uid()
      and sp.student_id = target_student
  );
$$;

-- ============================================================
-- profiles (extends auth.users)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
