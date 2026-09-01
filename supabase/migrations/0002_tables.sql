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
