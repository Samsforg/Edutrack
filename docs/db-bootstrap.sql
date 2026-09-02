-- ============================================================
-- EduTrack :: db-bootstrap.sql
-- Schéma SQL complet, concaténé depuis supabase/migrations/ (0000 -> 0017).
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

-- EduTrack :: 0015_import_jobs_performance.sql
-- Import jobs tracking table + performance indexes for Phase 6.

-- ── 1. import_jobs ──────────────────────────────────────────
create type public.import_type as enum (
  'students', 'parents', 'teachers', 'classes', 'subjects'
);

create type public.import_status as enum (
  'pending', 'processing', 'completed', 'failed', 'cancelled'
);

create table public.import_jobs (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  user_id       uuid not null references auth.users(id),
  type          public.import_type not null,
  status        public.import_status not null default 'pending',
  total_rows    int not null default 0,
  success_rows  int not null default 0,
  error_rows    int not null default 0,
  file_name     text,
  errors        jsonb,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

comment on table  public.import_jobs IS 'Trace chaque import CSV pour audit et historique.';
comment on column public.import_jobs.errors IS 'Détail des erreurs par ligne : [{row, field, value, error, solution}]';

alter table public.import_jobs enable row level security;

-- SELECT : admin de l'école
create policy "import_jobs_select"
  on public.import_jobs for select to authenticated
  using (public.is_admin_of_school(school_id));

-- INSERT : admin de l'école (le user_id est celui de la session)
create policy "import_jobs_insert"
  on public.import_jobs for insert to authenticated
  with check (public.is_admin_of_school(school_id) and user_id = auth.uid());

-- UPDATE : admin de l'école (pour mettre à jour status, error_rows, etc.)
create policy "import_jobs_update"
  on public.import_jobs for update to authenticated
  using (public.is_admin_of_school(school_id))
  with check (public.is_admin_of_school(school_id));

-- Index pour l'historique admin
create index idx_import_jobs_school_status
  on public.import_jobs (school_id, created_at desc)
  where status in ('completed', 'failed');

-- ── 2. Performance indexes ──────────────────────────────────
-- Colonnes FK/RLS/ORDER BY fréquemment utilisées qui n'ont pas d'index.

-- grades : FK + RLS
create index if not exists idx_grades_student_id
  on public.grades (student_id);
create index if not exists idx_grades_classroom_id
  on public.grades (classroom_id);
create index if not exists idx_grades_subject_id
  on public.grades (subject_id);
create index if not exists idx_grades_assessment_id
  on public.grades (assessment_id)
  where assessment_id is not null;

-- attendance : déjà (classroom_id, date) + (student_id, date)
-- mais l'index sur school_id pour RLS peut aider
create index if not exists idx_attendance_school_date
  on public.attendance (school_id, attendance_date desc);

-- assessments : FK/RLS
create index if not exists idx_assessments_class_subject
  on public.assessments (class_id, subject_id);
create index if not exists idx_assessments_school
  on public.assessments (school_id);
create index if not exists idx_assessments_period
  on public.assessments (academic_period_id)
  where academic_period_id is not null;

-- announcements : RLS
create index if not exists idx_announcements_school_published
  on public.announcements (school_id, published_at)
  where published_at is not null and archived_at is null;
create index if not exists idx_announcements_classroom
  on public.announcements (classroom_id)
  where audience = 'class' and published_at is not null and archived_at is null;

-- school_members : RLS
create index if not exists idx_school_members_user_school
  on public.school_members (user_id, school_id);

-- student_parents : RLS
create index if not exists idx_student_parents_parent
  on public.student_parents (parent_id);
create index if not exists idx_student_parents_student
  on public.student_parents (student_id);

-- notifications : RLS (user_id)
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- profiles PK is already indexed, no user_id column exists

-- ── 3. RLS optimization ─────────────────────────────────────
-- Utiliser (select auth.uid()) pour les politiques qui
-- filtrent sur auth.uid() afin que le planner cache la valeur.

-- 4. Log de vérification
do $$
begin
  raise notice 'Phase 6 migration 0015 appliquée : import_jobs + performance indexes.';
end;
$$;

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

-- ============================================================
-- EduTrack :: 0017_billing.sql
-- Phase 7 — Monétisation, abonnements, onboarding commercial.
-- Architecture de billing indépendante du fournisseur de paiement.
-- ============================================================

-- ── 1. Enum types ───────────────────────────────────────────
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended'
);

create type public.subscription_interval as enum ('month', 'year');

create type public.billing_provider as enum ('manual', 'stripe', 'paystack', 'flutterwave');

create type public.billing_event_type as enum (
  'checkout.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'trial.expired'
);

create type public.lead_status as enum ('new', 'contacted', 'demo', 'trial', 'converted', 'lost');

-- ── 2. subscription_plans ──────────────────────────────────
create table public.subscription_plans (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  description      text,
  price            numeric(12,2) not null default 0,
  currency         text not null default 'FCFA',
  billing_interval public.subscription_interval not null default 'year',
  max_students     int,
  max_teachers     int,
  max_admins       int,
  features         jsonb not null default '{}'::jsonb,
  active           boolean not null default true,
  is_default       boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.subscription_plans is
  'Catalogue des offres (Starter/Standard/Pro). Les prix & limites y sont centralisés.';

-- prix indicatifs (V1) — FCFA / an
insert into public.subscription_plans (code, name, description, price, currency, billing_interval,
  max_students, max_teachers, max_admins, features, is_default, sort_order, active)
values
  ('starter', 'Starter', 'Pour les petites écoles.',
   49000, 'FCFA', 'year', 150, 15, 1,
   '{"presence":true,"grades":true,"announcements":true,"notifications":true,
     "parent_portal":true,"dashboards":true,"imports":true,"reports_basic":true,
     "analytics_advanced":false,"reports_advanced":false,"exports":false,
     "priority_support":false,"extended_history":false}'::jsonb,
   false, 1, true),
  ('standard', 'Standard', 'Le choix le plus populaire pour les écoles en croissance.',
   99000, 'FCFA', 'year', 500, 50, 3,
   '{"presence":true,"grades":true,"announcements":true,"notifications":true,
     "parent_portal":true,"dashboards":true,"imports":true,"reports_basic":true,
     "analytics_advanced":true,"reports_advanced":true,"exports":true,
     "priority_support":false,"extended_history":true}'::jsonb,
   true, 2, true),
  ('pro', 'Pro', 'Pour les grands établissements et les besoins avancés.',
   199000, 'FCFA', 'year', 1500, 150, 10,
   '{"presence":true,"grades":true,"announcements":true,"notifications":true,
     "parent_portal":true,"dashboards":true,"imports":true,"reports_basic":true,
     "analytics_advanced":true,"reports_advanced":true,"exports":true,
     "priority_support":true,"extended_history":true}'::jsonb,
   false, 3, true);

create trigger trg_subscription_plans_updated_at
  before update on public.subscription_plans
  for each row execute procedure public.set_updated_at();

alter table public.subscription_plans enable row level security;

-- Les plans sont en lecture publique (page tarifs) ; l'écriture est réservée au super admin.
create policy "subscription_plans_select_public"
  on public.subscription_plans for select to anon, authenticated
  using (active = true or public.is_super_admin());

create policy "subscription_plans_admin_all"
  on public.subscription_plans for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── 3. school_subscriptions ────────────────────────────────
create table public.school_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  school_id              uuid not null unique references public.schools(id) on delete cascade,
  plan_id                uuid not null references public.subscription_plans(id),
  status                 public.subscription_status not null default 'trialing',
  trial_started_at       timestamptz,
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  provider               public.billing_provider not null default 'manual',
  provider_customer_id   text,
  provider_subscription_id text,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint school_subscriptions_status_check check (
    (status = 'trialing' and trial_ends_at is not null)
    or status <> 'trialing'
  )
);

comment on table public.school_subscriptions is
  'Abonnement actuel d''une école. Architecture indépendante du fournisseur de paiement.';
comment on column public.school_subscriptions.provider IS
  'Fournisseur de paiement (manual = pas encore câblé).';

create trigger trg_school_subscriptions_updated_at
  before update on public.school_subscriptions
  for each row execute procedure public.set_updated_at();

create index idx_school_subscriptions_status
  on public.school_subscriptions (status);
create index idx_school_subscriptions_plan
  on public.school_subscriptions (plan_id);

alter table public.school_subscriptions enable row level security;

-- Sélecteur . détaillé plus bas (voir après les helpers).

-- ── 4. Helper : statut effectif de l'abonnement ────────────
-- Calcule l'état "réel" tenant compte des dates (trial expiré, période expirée).
create or replace function public.effective_subscription_status(target_school uuid)
returns public.subscription_status
language sql
stable
security definer
set search_path = public
as $$
  select case
    when s.status = 'trialing' and s.trial_ends_at < now() then 'expired'::public.subscription_status
    when s.status in ('active','trialing') and s.current_period_end is not null
         and s.current_period_end < now() then 'expired'::public.subscription_status
    when s.status = 'canceled' and s.cancel_at_period_end = false then 'canceled'::public.subscription_status
    else s.status
  end
  from public.school_subscriptions s
  where s.school_id = target_school;
$$;

-- RLS school_subscriptions : un membre de l'école voit SA SEULE ligne.
create policy "school_subscriptions_select_member"
  on public.school_subscriptions for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

-- Insertion : super admin seulement (création école) — jamais par un membre.
create policy "school_subscriptions_admin_insert"
  on public.school_subscriptions for insert to authenticated
  with check (public.is_super_admin());

-- Mise à jour : super admin seulement (via table). Les actions du school admin
-- (changer de plan, annuler, renouveler) passent par les fonctions serveur
-- (service role) et jamais par le client frontend.
create policy "school_subscriptions_admin_update"
  on public.school_subscriptions for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── 5. billing_events ──────────────────────────────────────
create table public.billing_events (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid references public.schools(id) on delete set null,
  provider       public.billing_provider not null,
  event_id       text not null,
  event_type     text not null,
  payload        jsonb not null default '{}'::jsonb,
  processed      boolean not null default false,
  processed_at   timestamptz,
  error          text,
  created_at     timestamptz not null default now()
);

comment on table public.billing_events is
  'Journal des événements webhook (idempotence : un seul traitement par provider+event_id).';

-- Contrainte unique anti-doublon sur (provider, event_id)
create unique index billing_events_provider_event_uniq
  on public.billing_events (provider, event_id);

alter table public.billing_events enable row level security;

-- Seul le super admin (et la fonction serveur security definer) lit/écrit.
create policy "billing_events_superadmin_all"
  on public.billing_events for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── 6. school_leads ────────────────────────────────────────
create table public.school_leads (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  school_name      text,
  email            text,
  phone            text,
  city             text,
  est_students     int,
  message          text,
  status           public.lead_status not null default 'new',
  source           text not null default 'contact',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.school_leads is
  'Demandes de contact / démo commerciales. Stockage sécurisé (pas de données bancaires).';

create trigger trg_school_leads_updated_at
  before update on public.school_leads
  for each row execute procedure public.set_updated_at();

alter table public.school_leads enable row level security;

-- Insertion : public (formulaire contact/démo). Lecture/mise à jour : super admin.
create policy "school_leads_insert_public"
  on public.school_leads for insert to anon, authenticated
  with check (true);

create policy "school_leads_superadmin_read"
  on public.school_leads for select to authenticated
  using (public.is_super_admin());

create policy "school_leads_superadmin_update"
  on public.school_leads for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── 7. billing_audit_logs ─────────────────────────────────
create table public.billing_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  school_id     uuid references public.schools(id) on delete cascade,
  action        text not null,
  old_value     jsonb,
  new_value     jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.billing_audit_logs is
  'Audit des modifications exceptionnelles / administrateurs des abonnements.';

alter table public.billing_audit_logs enable row level security;

create policy "billing_audit_logs_superadmin_all"
  on public.billing_audit_logs for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create index idx_billing_audit_logs_school
  on public.billing_audit_logs (school_id, created_at desc);

-- ── 8. Provider-accessor pour RLS / vues (menu) ─────────────
create or replace function public.school_subscription_for(_school uuid)
returns setof public.school_subscriptions
language sql
stable
security definer
set search_path = public
as $$
  select * from public.school_subscriptions where school_id = _school;
$$;

-- ── 9. Essai gratuit : création automatique à la création de l'école ──
-- TRIAL_DAYS est centralisé (14) ; n'est PAS dispersé dans le code client.
create or replace function public.auto_create_trial_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_plan uuid;
begin
  select id into default_plan
  from public.subscription_plans
  where active = true
  order by is_default desc, sort_order asc
  limit 1;

  if default_plan is null then
    return new;
  end if;

  insert into public.school_subscriptions (
    school_id, plan_id, status, trial_started_at, trial_ends_at,
    current_period_start, current_period_end, provider
  )
  values (
    new.id, default_plan, 'trialing', now(),
    now() + interval '14 days',
    now(), now() + interval '14 days',
    'manual'
  )
  on conflict (school_id) do nothing;

  return new;
end;
$$;

create trigger trg_schools_auto_trial
  after insert on public.schools
  for each row execute procedure public.auto_create_trial_subscription();

do $$
begin
  raise notice 'Phase 7 migration 0017 appliquée : billing + abonnements + leads + audit.';
end;
$$;
