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