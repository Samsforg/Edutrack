-- ============================================================
-- EduTrack :: db-bootstrap.sql
-- Schéma SQL complet, concaténé depuis supabase/migrations/ (0000 -> 0013).
-- Généré automatiquement — ne pas modifier à la main.
-- ============================================================

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

-- ============================================================
-- EduTrack :: 0002_tables.sql
-- Core business tables.
-- ============================================================

-- Postal code for link codes (removed ambiguity).
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  logo_url text,
  status public.school_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, school_id)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  name text not null,
  grade_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year_id, name)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  employee_number text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, employee_number)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  classroom_id uuid references public.classes (id) on delete set null,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  matricule text not null,
  link_code text,
  first_name text not null,
  last_name text not null,
  birth_date date,
  gender text,
  enrollment_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, matricule),
  unique (school_id, link_code)
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_parents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  parent_id uuid not null references public.parents (id) on delete cascade,
  relationship text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, parent_id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  classroom_id uuid references public.classes (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  attendance_date date not null default current_date,
  status public.attendance_status not null,
  taken_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- MVP rule: one attendance record per student per day.
  unique (student_id, attendance_date)
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  classroom_id uuid references public.classes (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  title text not null,
  score numeric not null check (score >= 0),
  max_score numeric not null check (max_score > 0),
  coefficient numeric not null default 1 check (coefficient > 0),
  grade_date date not null default current_date,
  comment text,
  created_at timestamptz not null default now(),
  check (score <= max_score)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  audience public.announcement_audience not null default 'all',
  classroom_id uuid references public.classes (id) on delete set null,
  title text not null,
  body text not null,
  important boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.student_link_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  parent_id uuid references public.parents (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  code text not null,
  status public.link_request_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_school_members_user on public.school_members (user_id);
create index idx_school_members_school on public.school_members (school_id);

create index idx_classes_school on public.classes (school_id);
create index idx_classes_academic_year on public.classes (academic_year_id);

create index idx_teachers_school on public.teachers (school_id);
create index idx_teachers_user on public.teachers (user_id);

create index idx_subjects_school on public.subjects (school_id);

create index idx_class_subjects_class on public.class_subjects (class_id);
create index idx_class_subjects_teacher on public.class_subjects (teacher_id);

create index idx_students_school on public.students (school_id);
create index idx_students_class on public.students (classroom_id);
create index idx_students_academic_year on public.students (academic_year_id);
create index idx_students_link_code on public.students (school_id, link_code);

create index idx_parents_school on public.parents (school_id);
create index idx_parents_user on public.parents (user_id);

create index idx_student_parents_student on public.student_parents (student_id);
create index idx_student_parents_parent on public.student_parents (parent_id);

create index idx_attendance_school on public.attendance (school_id);
create index idx_attendance_student on public.attendance (student_id);
create index idx_attendance_class on public.attendance (classroom_id);
create index idx_attendance_date on public.attendance (attendance_date);
create index idx_attendance_school_date on public.attendance (school_id, attendance_date);

create index idx_grades_school on public.grades (school_id);
create index idx_grades_student on public.grades (student_id);
create index idx_grades_subject on public.grades (subject_id);
create index idx_grades_teacher on public.grades (teacher_id);

create index idx_announcements_school on public.announcements (school_id);
create index idx_announcements_class on public.announcements (classroom_id);

create index idx_notifications_user on public.notifications (user_id);
create index idx_notifications_user_read on public.notifications (user_id, read_at);

create index idx_link_requests_parent on public.student_link_requests (parent_id);
create index idx_link_requests_student on public.student_link_requests (student_id);
create index idx_link_requests_school on public.student_link_requests (school_id);

-- ============================================================
-- updated_at triggers
-- ============================================================

create trigger schools_updated_at before update on public.schools
  for each row execute procedure public.set_updated_at();
create trigger academic_years_updated_at before update on public.academic_years
  for each row execute procedure public.set_updated_at();
create trigger classes_updated_at before update on public.classes
  for each row execute procedure public.set_updated_at();
create trigger teachers_updated_at before update on public.teachers
  for each row execute procedure public.set_updated_at();
create trigger subjects_updated_at before update on public.subjects
  for each row execute procedure public.set_updated_at();
create trigger students_updated_at before update on public.students
  for each row execute procedure public.set_updated_at();
create trigger parents_updated_at before update on public.parents
  for each row execute procedure public.set_updated_at();
create trigger attendance_updated_at before update on public.attendance
  for each row execute procedure public.set_updated_at();
create trigger announcements_updated_at before update on public.announcements
  for each row execute procedure public.set_updated_at();
create trigger link_requests_updated_at before update on public.student_link_requests
  for each row execute procedure public.set_updated_at();

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

-- ============================================================
-- EduTrack :: 0003_rls.sql
-- Row Level Security policies.
-- Core rule: a user can only ever access data of schools they
-- belong to. Parents only access their own children's data.
-- Authorization helpers are defined in 0002_helpers.sql.
-- ============================================================

-- ============================================================
-- Enable RLS everywhere
-- ============================================================

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.teachers enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.student_parents enable row level security;
alter table public.attendance enable row level security;
alter table public.grades enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.student_link_requests enable row level security;

-- ============================================================
-- profiles
-- ============================================================
create policy "profiles_select_own_or_school_peer" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.school_members v
      join public.school_members t on t.school_id = v.school_id
      where v.user_id = auth.uid() and t.user_id = profiles.id
        and not exists (
          select 1 from public.school_members p
          where p.user_id = auth.uid() and p.role = 'PARENT'
        )
    )
  );

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- schools
-- ============================================================
create policy "schools_select_member" on public.schools
  for select to authenticated
  using (public.is_school_member(auth.uid(), id) or public.is_super_admin());

create policy "schools_admin_write" on public.schools
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- school_members
-- ============================================================
create policy "members_select_non_parent" on public.school_members
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_school_member(auth.uid(), school_id)
      and not exists (
        select 1 from public.school_members me
        where me.user_id = auth.uid() and me.school_id = school_members.school_id
          and me.role = 'PARENT'
      )
    )
  );

create policy "members_admin_manage" on public.school_members
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- academic_years
-- ============================================================
create policy "academic_years_select_member" on public.academic_years
  for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

create policy "academic_years_admin_write" on public.academic_years
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- classes
-- ============================================================
create policy "classes_select_member" on public.classes
  for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

create policy "classes_admin_write" on public.classes
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- teachers
-- ============================================================
create policy "teachers_select_member" on public.teachers
  for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

create policy "teachers_admin_write" on public.teachers
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- subjects
-- ============================================================
create policy "subjects_select_member" on public.subjects
  for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

create policy "subjects_admin_write" on public.subjects
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- class_subjects
-- ============================================================
create policy "class_subjects_select_member" on public.class_subjects
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.classes c
      where c.id = class_subjects.class_id
        and public.is_school_member(auth.uid(), c.school_id)
    )
  );

create policy "class_subjects_admin_write" on public.class_subjects
  for all to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_subjects.class_id
        and (public.is_admin_of_school(c.school_id) or public.user_teaches_class(c.id))
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_subjects.class_id
        and (public.is_admin_of_school(c.school_id) or public.user_teaches_class(c.id))
    )
  );

-- ============================================================
-- students
-- ============================================================
create policy "students_select_member_or_linked_parent" on public.students
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_school_member(auth.uid(), school_id)
    or public.parent_of_student(id)
  );

create policy "students_admin_write" on public.students
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- parents
-- ============================================================
create policy "parents_select_member" on public.parents
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_school_member(auth.uid(), school_id)
    or user_id = auth.uid()
  );

create policy "parents_admin_write" on public.parents
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- student_parents
-- ============================================================
create policy "student_parents_select" on public.student_parents
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or exists (
      select 1 from public.students s
      where s.id = student_parents.student_id
        and public.is_school_member(auth.uid(), s.school_id)
    )
  );

create policy "student_parents_admin_write" on public.student_parents
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_parents.student_id
        and (public.is_admin_of_school(s.school_id) or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_parents.student_id
        and (public.is_admin_of_school(s.school_id) or public.is_super_admin())
    )
  );

-- ============================================================
-- attendance
-- ============================================================
create policy "attendance_select" on public.attendance
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or public.is_school_member(auth.uid(), school_id)
  );

create policy "attendance_write" on public.attendance
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id
        and (
          public.is_admin_of_school(s.school_id)
          or (classroom_id is not null and public.user_teaches_class(classroom_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id
        and (
          public.is_admin_of_school(s.school_id)
          or (classroom_id is not null and public.user_teaches_class(classroom_id))
        )
    )
  );

-- ============================================================
-- grades
-- ============================================================
create policy "grades_select" on public.grades
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or public.is_school_member(auth.uid(), school_id)
  );

create policy "grades_write" on public.grades
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = grades.student_id
        and (
          public.is_admin_of_school(s.school_id)
          or (classroom_id is not null and public.user_teaches_class(classroom_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = grades.student_id
        and (
          public.is_admin_of_school(s.school_id)
          or (classroom_id is not null and public.user_teaches_class(classroom_id))
        )
    )
  );

-- ============================================================
-- announcements
-- ============================================================
create policy "announcements_select" on public.announcements
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_school_member(auth.uid(), school_id)
      and (
        audience = 'all'
        or (
          audience = 'class'
          and (
            public.is_admin_of_school(school_id)
            or public.user_teaches_class(classroom_id)
            or exists (
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
    )
  );

create policy "announcements_admin_write" on public.announcements
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- notifications
-- ============================================================
create policy "notifications_own" on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- student_link_requests
-- ============================================================
create policy "link_requests_select" on public.student_link_requests
  for select to authenticated
  using (
    public.is_admin_of_school(school_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.parents p
      where p.id = student_link_requests.parent_id and p.user_id = auth.uid()
    )
  );

-- Parents create their own link requests (must be a parent in the school, or providing the code confirms the child).
create policy "link_requests_parent_insert" on public.student_link_requests
  for insert to authenticated
  with check (
    parent_id is null
    or exists (
      select 1 from public.parents p
      where p.id = parent_id and p.user_id = auth.uid()
    )
  );

create policy "link_requests_admin_update" on public.student_link_requests
  for update to authenticated
  using (
    public.is_admin_of_school(school_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.parents p
      where p.id = parent_id and p.user_id = auth.uid() and status = 'pending'
    )
  )
  with check (true);

create policy "link_requests_admin_delete" on public.student_link_requests
  for delete to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- EduTrack :: 0004_functions.sql
-- Security-definer functions exposed as RPC endpoints.
-- These let parents participate in the linking flow without
-- being able to SELECT arbitrary students (RLS stays strict).
-- ============================================================

-- Resolves a link code to a student within a school.
-- Returns only the student id and school id — nothing else, so
-- a parent cannot enumerate or inspect students.
create or replace function public.resolve_link_code(target_school uuid, code text)
returns table (student_id uuid, school_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id as student_id, s.school_id
  from public.students s
  where s.school_id = target_school
    and upper(s.link_code) = upper(btrim(code))
  limit 1;
$$;

comment on function public.resolve_link_code(uuid, text) is
  'Returns the student matching a link code, or empty when none. Security definer: parent can claim without bypassing RLS on students.';

-- Creates a link request for the calling parent. Security definer so the
-- caller never needs SELECT on other students.
create or replace function public.create_link_request(target_school uuid, p_code text)
returns table (request_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student uuid;
  v_parent uuid;
  v_school uuid;
begin
  -- Resolve the code.
  select s.id, s.school_id into v_student, v_school
  from public.students s
  where s.school_id = target_school
    and upper(s.link_code) = upper(btrim(p_code));

  if v_student is null then
    raise exception 'CODE_NOT_FOUND';
  end if;

  -- Find the parent row for the current user in this school.
  select p.id into v_parent
  from public.parents p
  where p.school_id = target_school
    and p.user_id = auth.uid()
  limit 1;

  -- Reject duplicate pending requests.
  if exists (
    select 1 from public.student_link_requests r
    where r.student_id = v_student
      and r.status = 'pending'
      and (
        (v_parent is not null and r.parent_id = v_parent)
        or (v_parent is null and upper(btrim(r.code)) = upper(btrim(p_code)))
      )
  ) then
    raise exception 'PENDING_EXISTS';
  end if;

  insert into public.student_link_requests (
    school_id, parent_id, student_id, code, status, expires_at
  ) values (
    v_school, v_parent, v_student, upper(btrim(p_code)), 'pending',
    now() + interval '7 days'
  )
  returning id into v_student;

  return query select v_student::uuid;
end;
$$;

comment on function public.create_link_request(uuid, text) is
  'Creates a pending parent-child link request from a link code.';

-- Sets a request status. Only the owning parent may update their own
-- pending request (used to cancel it). Admins act through RLS directly.
create or replace function public.set_link_request_status(request_id uuid, new_status public.link_request_status)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent uuid;
begin
  select r.parent_id into v_parent
  from public.student_link_requests r
  where r.id = request_id;

  if v_parent is null then
    raise exception 'NOT_ALLOWED';
  end if;

  select p.id into v_parent
  from public.parents p
  where p.id = v_parent and p.user_id = auth.uid();

  if v_parent is null then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.student_link_requests
  set status = new_status
  where id = request_id;
end;
$$;

-- ============================================================
-- EduTrack :: 0005_rls_harden.sql
-- Parents are school members (for announcements, notifications,
-- comments) but must ONLY read their own children's data.
-- The previous read policies allowed ANY school member — including
-- parents — to see all students, attendance, grades and links.
-- This migration restricts those reads to non-parent members.
-- ============================================================

-- True when the given user belongs to the school with a role other
-- than PARENT. Parents get data exclusively through parent_of_student.
create or replace function public.is_school_non_parent_member(target_user uuid, target_school uuid)
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
      and sm.role <> 'PARENT'
  );
$$;

-- ============================================================
-- students
-- ============================================================
drop policy if exists "students_select_member_or_linked_parent" on public.students;
create policy "students_select_member_or_linked_parent" on public.students
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(id)
    or public.is_school_non_parent_member(auth.uid(), school_id)
  );

-- ============================================================
-- attendance
-- ============================================================
drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or public.is_school_non_parent_member(auth.uid(), school_id)
  );

-- ============================================================
-- grades
-- ============================================================
drop policy if exists "grades_select" on public.grades;
create policy "grades_select" on public.grades
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or public.is_school_non_parent_member(auth.uid(), school_id)
  );

-- ============================================================
-- student_parents
-- ============================================================
drop policy if exists "student_parents_select" on public.student_parents;
create policy "student_parents_select" on public.student_parents
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or exists (
      select 1 from public.students s
      where s.id = student_parents.student_id
        and public.is_school_non_parent_member(auth.uid(), s.school_id)
    )
  );

-- A teacher/adult member must still be able to see classmates list
-- via classes, but parents should NOT be able to enumerate class
-- rosters through students. Covered above by role exclusion.

-- ============================================================
-- EduTrack :: 0006_fix_parent_of_student.sql
-- parent_of_student() scoped the school only, leaking every
-- student that has ANY parent in the caller's school. The parent
-- row is now bound to auth.uid() (security first): a parent can
-- only ever resolve a student through their OWN parents row.
-- Also hardens the parents read policy (no cross-parent leak).
-- ============================================================

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

-- ============================================================
-- parents
-- ============================================================
drop policy if exists "parents_select_member" on public.parents;
create policy "parents_select_member" on public.parents
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_school_non_parent_member(auth.uid(), school_id)
    or user_id = auth.uid()
  );

-- ============================================================
-- EduTrack :: 0007_fix_notifications_rls.sql
-- notifications_own enforced user_id = auth.uid() for ALL commands,
-- so staff (admin/teacher) could NEVER deliver notifications to
-- parents. Using a SECURITY DEFINER helper avoids infinite
-- recursion (reading school_members inside a policy triggered
-- staff policies referencing school_members again).
-- ============================================================

-- True when the current user is a non-PARENT member of the school
-- of the given target parent account. SECURITY DEFINER so it reads
-- school_members/parents without re-evaluating their RLS policies.
create or replace function public.staff_can_notify_parent(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.parents p
    where p.user_id = target_user
      and exists (
        select 1
        from public.school_members sm
        where sm.user_id = auth.uid()
          and sm.school_id = p.school_id
          and sm.role <> 'PARENT'
      )
  );
$$;

drop policy if exists "notifications_staff_insert" on public.notifications;
create policy "notifications_staff_insert" on public.notifications
  for insert to authenticated
  with check (public.staff_can_notify_parent(user_id));

-- keep owner-only for select/update/delete
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- EduTrack :: 0008_fix_members_recursion.sql
-- members_select_non_parent had an inline "not exists (select ..
-- from school_members me ...)" inside a policy ON school_members.
-- PostgreSQL re-evaluates RLS for that inline select, causing
-- infinite recursion (42P17) that broke getUserMemberships() and
-- therefore login (primaryRole stayed null). Moved the parent
-- check into a SECURITY DEFINER helper to break the cycle.
-- ============================================================

-- True when the current user is a PARENT member of the given school.
create or replace function public.is_school_parent_member(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.school_members sm
    where sm.user_id = auth.uid()
      and sm.school_id = target_school
      and sm.role = 'PARENT'
  );
$$;

drop policy if exists "members_select_non_parent" on public.school_members;
create policy "members_select_non_parent" on public.school_members
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_school_member(auth.uid(), school_id)
      and not public.is_school_parent_member(school_id)
    )
  );

-- Everyone (including parents) may read their OWN membership row so that
-- getUserMemberships() / login resolves the primary role. Parents must not
-- be able to enumerate other members: members_select_non_parent already
-- hides other members' rows as appropriate.
drop policy if exists "members_select_own" on public.school_members;
create policy "members_select_own" on public.school_members
  for select to authenticated
  using (user_id = auth.uid());

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

-- ============================================================
-- EduTrack :: 0010_school_admin_update_policy.sql
-- Allows a SCHOOL_ADMIN to update their OWN school's record
-- (name + contact details) through RLS.
-- SUPER_ADMIN keeps full access via schools_admin_write.
-- ============================================================

create policy "schools_admin_update_own" on public.schools
  for update to authenticated
  using (public.is_admin_of_school(id) or public.is_super_admin())
  with check (public.is_admin_of_school(id) or public.is_super_admin());

-- ============================================================
-- EduTrack :: 0011_secure_parent_linking.sql
--
-- Liaison parent <-> élève sécurisée :
--  1. Table dédiée `student_link_codes` : les codes ne sont JAMAIS
--     stockés en clair. On stocke `code_salt` (aléatoire par code)
--     + `code_hash = sha256(code_salt || code_normalisé)`. Le hash
--     est indexable en égalité (codes ~80 bits d'entropie), le sel
--     empêche toute pré-computation. Durée de vie 7 jours, usage
--     unique (used_at), révocation (revoked_at).
--  2. `link_code_attempts` : table de rate limiting (anti brute
--     force) alimentée par les RPC de vérification/création.
--  3. `student_link_requests` : suppression définitive de la
--     colonne `code` (en clair) ; ajout de `link_code_id`
--     (traçabilité), `resolved_by` / `resolved_at` / `reason`
--     (approbation / rejet).
--  4. RPC réécrites : `verify_link_code`, `create_link_request`,
--     `resolve_link_request`. Les anciens RPC basés sur
--     `students.link_code` (en clair) sont supprimés.
--  5. RLS : les parents ne peuvent NI lister/voir les codes, NI
--     voir les demandes des autres, NI modifier le statut d'une
--     demande (uniquement annuler la leur via RPC).
-- ============================================================

-- ============================================================
-- 1. Table des codes de liaison (hachés)
-- ============================================================

create table public.student_link_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  code_salt text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text,
  used_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (revoked_at is null or used_at is null)
);

-- Un seul code actif par élève (le "régénérer" révoque l'ancien).
create unique index uq_link_codes_active_student
  on public.student_link_codes (student_id)
  where revoked_at is null and used_at is null;

-- Lookup par hash en égalité.
create unique index uq_link_codes_hash on public.student_link_codes (code_hash);
create index idx_link_codes_school on public.student_link_codes (school_id);
create index idx_link_codes_student on public.student_link_codes (student_id);

alter table public.student_link_codes enable row level security;

-- Seuls les admins de l'école (ou super-admin) voient/gèrent ses codes.
create policy "link_codes_admin_all" on public.student_link_codes
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

create trigger student_link_codes_updated_at before update on public.student_link_codes
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 2. Table de rate limiting (anti brute-force)
-- ============================================================
-- Aucune politique : seul un SECURITY DEFINER (les RPC) peut la
-- lire/écrire ; tout accès direct `authenticated` est refusé.

create table public.link_code_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index idx_link_code_attempts_user_time
  on public.link_code_attempts (user_id, attempted_at desc);

alter table public.link_code_attempts enable row level security;

-- ============================================================
-- 3. student_link_requests : plus aucun code en clair
-- ============================================================

alter table public.student_link_requests
  drop column code,
  add column link_code_id uuid references public.student_link_codes (id) on delete set null,
  add column resolved_by uuid references public.profiles (id) on delete set null,
  add column resolved_at timestamptz,
  add column reason text;

create index idx_link_requests_code on public.student_link_requests (link_code_id);
create index idx_link_requests_school_status
  on public.student_link_requests (school_id, status, created_at desc);
create index idx_link_requests_parent_status
  on public.student_link_requests (parent_id, status);

-- ============================================================
-- 4. Rate limiter (partagé par les RPC de vérification/création)
-- ============================================================

create or replace function public.attempt_slowdown()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.link_code_attempts (user_id)
  values (auth.uid());

  if (
    select count(*)
    from public.link_code_attempts
    where user_id = auth.uid()
      and attempted_at > now() - interval '5 minutes'
  ) > 10 then
    raise exception 'RATE_LIMITED';
  end if;
end;
$$;

-- ============================================================
-- 5. Anciens RPC basés sur le code en clair : suppression
-- ============================================================

drop function if exists public.resolve_link_code(uuid, text);
drop function if exists public.create_link_request(uuid, text);
drop function if exists public.set_link_request_status(uuid, public.link_request_status);

-- ============================================================
-- 6. verify_link_code : vérifie un code sans le consommer
-- ============================================================
-- Retourne uniquement des infos minimales de confirmation
-- (prénom, nom, nom de l'école) après validation du code.
-- Ne retourne NI matricule NI classe NI établissement sinon.

create or replace function public.verify_link_code(p_code text)
returns table (student_id uuid, school_id uuid, first_name text, last_name text, school_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student uuid;
  v_school uuid;
begin
  perform public.attempt_slowdown();

  select c.student_id, c.school_id into v_student, v_school
  from public.student_link_codes c
  where c.revoked_at is null
    and c.used_at is null
    and c.expires_at > now()
    and c.code_hash = encode(extensions.digest(c.code_salt || upper(btrim(p_code)), 'sha256'), 'hex')
  limit 1;

  if v_student is null then
    return;
  end if;

  return query
    select s.id, s.school_id, s.first_name, s.last_name, sc.name
    from public.students s
    join public.schools sc on sc.id = s.school_id
    where s.id = v_student;
end;
$$;

comment on function public.verify_link_code(text) is
  'Vérifie un code de liaison actif et retourne une confirmation minimale (aucun matricule/classe).';

-- ============================================================
-- 7. create_link_request : vérifie + consomme + crée la demande
-- ============================================================
-- Atomicité : le code est consommé (used_at) dans la même
-- transaction que la création de la demande (usage unique).
-- Le parent est rattaché via une ligne `parents` (école du code),
-- jamais via school_members (rattachement retardé à l'approbation).

create or replace function public.create_link_request(p_code text)
returns table (request_id uuid, student_first_name text, student_last_name text, school_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code_id uuid;
  v_student uuid;
  v_school uuid;
  v_code_expires timestamptz;
  v_parent uuid;
  v_full_name text;
  v_first text;
  v_last text;
  v_request_id uuid;
begin
  perform public.attempt_slowdown();

  select c.id, c.student_id, c.school_id, c.expires_at
    into v_code_id, v_student, v_school, v_code_expires
  from public.student_link_codes c
  where c.revoked_at is null
    and c.used_at is null
    and c.expires_at > now()
    and c.code_hash = encode(extensions.digest(c.code_salt || upper(btrim(p_code)), 'sha256'), 'hex')
  limit 1;

  if v_code_id is null then
    raise exception 'CODE_NOT_FOUND';
  end if;

  -- Consomme le code atomiquement (usage unique).
  update public.student_link_codes
    set used_at = now()
  where id = v_code_id
    and used_at is null;
  if not found then
    raise exception 'CODE_NOT_FOUND';
  end if;

  -- Garantit une ligne `parents` liée à ce user + cette école.
  select p.id into v_parent
  from public.parents p
  where p.school_id = v_school
    and p.user_id = auth.uid()
  limit 1;

  if v_parent is null then
    select p.full_name into v_full_name
    from public.profiles p
    where p.id = auth.uid();

    v_full_name := coalesce(nullif(btrim(v_full_name), ''), 'Parent');
    v_first := nullif(split_part(v_full_name, ' ', 1), '');
    v_last := nullif(btrim(substr(v_full_name, length(v_first) + 2)), '');

    insert into public.parents (school_id, user_id, first_name, last_name)
    values (v_school, auth.uid(), coalesce(v_first, 'Parent'), coalesce(v_last, 'Parent'))
    returning id into v_parent;
  end if;

  if exists (
    select 1 from public.student_link_requests r
    where r.student_id = v_student
      and r.parent_id = v_parent
      and r.status = 'pending'
  ) then
    raise exception 'PENDING_EXISTS';
  end if;

  insert into public.student_link_requests (
    school_id, parent_id, student_id, link_code_id, status, expires_at
  ) values (
    v_school, v_parent, v_student, v_code_id, 'pending', v_code_expires
  )
  returning id into v_request_id;

  return query
    select
      v_request_id,
      s.first_name,
      s.last_name,
      sc.name,
      v_code_expires
    from public.students s
    join public.schools sc on sc.id = s.school_id
    where s.id = v_student;
end;
$$;

comment on function public.create_link_request(text) is
  'Crée une demande de liaison (statut pending) et consomme le code (usage unique).';

-- ============================================================
-- 8. resolve_link_request : approbation / rejet / annulation
-- ============================================================
--  - ADMIN de l'école (ou super-admin) : approuve ou rejette.
--  - Parent : seulement annuler sa propre demande (rejected).
--  - Transaction atomique : création de student_parents +
--    rattachement school_members (PARENT) + notification.
--  - La création de student_parents est protégée par la
--    contrainte unique (student_id, parent_id) : aucune
--    double liaison possible (re-approbation -> NOT_PENDING).

create or replace function public.resolve_link_request(p_request_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.student_link_requests;
  v_parent_user uuid;
  v_admin boolean := false;
  v_parent_owner boolean := false;
begin
  select * into v_row
  from public.student_link_requests r
  where r.id = p_request_id
  for update;

  if v_row.id is null then
    raise exception 'NOT_FOUND';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'NOT_PENDING';
  end if;

  if v_row.expires_at < now() then
    raise exception 'EXPIRED';
  end if;

  v_admin := public.is_super_admin()
             or public.user_has_role(v_row.school_id, 'SCHOOL_ADMIN');

  if not v_admin and v_row.parent_id is not null then
    v_parent_owner := exists (
      select 1 from public.parents p
      where p.id = v_row.parent_id
        and p.user_id = auth.uid()
    );
  end if;

  if not v_admin and not v_parent_owner then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_status = 'approved' then
    if v_parent_owner then
      raise exception 'NOT_ALLOWED';
    end if;
    if v_row.parent_id is not null then
      insert into public.student_parents (student_id, parent_id)
      values (v_row.student_id, v_row.parent_id)
      on conflict (student_id, parent_id) do nothing;
    end if;
  elsif p_status <> 'rejected' then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.student_link_requests
    set status = p_status::public.link_request_status,
        resolved_by = auth.uid(),
        resolved_at = now(),
        reason = case
          when p_status = 'rejected'
            then coalesce(
              nullif(btrim(coalesce(p_reason, '')), ''),
              case when v_parent_owner then 'Demande annulée par le parent'
                   else 'Demande rejetée' end
            )
          else null end
  where id = p_request_id;

  if p_status = 'approved' and v_row.parent_id is not null then
    select user_id into v_parent_user from public.parents where id = v_row.parent_id;
    if v_parent_user is not null then
      -- Rattachement (retardé à l'approbation) à l'école.
      insert into public.school_members (user_id, school_id, role)
      values (v_parent_user, v_row.school_id, 'PARENT')
      on conflict (user_id, school_id) do nothing;
    end if;
  end if;

  if v_row.parent_id is not null then
    select user_id into v_parent_user from public.parents where id = v_row.parent_id;
    if v_parent_user is not null then
      insert into public.notifications (user_id, type, title, body, link)
      values (
        v_parent_user, 'system',
        case
          when p_status = 'approved' then 'Demande de liaison approuvée'
          when v_parent_owner then 'Demande de liaison annulée'
          else 'Demande de liaison rejetée'
        end,
        case
          when p_status = 'approved' then 'Votre demande de suivi a été acceptée par l''établissement.'
          when v_parent_owner then 'Vous avez annulé votre demande de liaison.'
          else 'Votre demande de liaison a été rejetée. Motif : ' || coalesce(
            nullif(btrim(coalesce(p_reason, '')), ''), 'demande rejetée'
          )
        end,
        '/app/parent/link-requests'
      );
    end if;
  end if;
end;
$$;

comment on function public.resolve_link_request(uuid, text, text) is
  'Approving/rejecting by the school admin, or cancelling by the owning parent.';

-- ============================================================
-- 9. RLS : renforcement des demandes de liaison
-- ============================================================

-- Un parent ne peut NI créer une demande pour la mauvaise école,
-- NI modifier une demande (y compris passer status=approved) :
-- il ne peut qu'annuler la sienne via resolve_link_request (RPC).
drop policy if exists "link_requests_parent_insert" on public.student_link_requests;
create policy "link_requests_parent_insert" on public.student_link_requests
  for insert to authenticated
  with check (
    exists (
      select 1 from public.parents p
      where p.id = parent_id
        and p.user_id = auth.uid()
        and p.school_id = school_id
    )
  );

drop policy if exists "link_requests_admin_update" on public.student_link_requests;
create policy "link_requests_update_admin_only" on public.student_link_requests
  for update to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- EduTrack :: 0012_drop_students_link_code.sql
-- Suppression de la colonne `students.link_code` (stockée en
-- clair). L'architecture de liaison passe désormais
-- exclusivement par `student_link_codes` (code haché).
-- La suppression retire également la contrainte
-- `unique (school_id, link_code)` et l'index
-- `idx_students_link_code` qui en dépendent.
-- ============================================================

alter table public.students drop column if exists link_code;

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

