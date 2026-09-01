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
$$;-- ============================================================
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
$$;-- ============================================================
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
-- rosters through students. Covered above by role exclusion.-- ============================================================
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
  );-- ============================================================
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
  with check (user_id = auth.uid());-- ============================================================
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
-- Version bookkeeping (Supabase CLI compatibility)
-- ============================================================
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text not null
);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20250401000000', 'init'),
  ('20250401000001', 'tables'),
  ('20250401000002', 'helpers'),
  ('20250401000003', 'rls'),
  ('20250401000004', 'functions'),
  ('20250401000005', 'rls_harden'),
  ('20250401000006', 'fix_parent_of_student'),
  ('20250401000007', 'fix_notifications_rls'),
  ('20250401000008', 'fix_members_recursion')
on conflict (version) do nothing;
