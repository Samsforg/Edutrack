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
-- Multi-tenancy helper functions live in 0002_helpers.sql
-- (they reference tables created in 0001_tables.sql, and
-- PostgreSQL validates SQL functions at creation time).
-- ============================================================

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
