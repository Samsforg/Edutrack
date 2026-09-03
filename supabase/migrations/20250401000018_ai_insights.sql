-- ============================================================
-- EduTrack :: 0018_ai_insights.sql
-- Phase 8 — Intelligence, insights, automatisation, communication.
-- Ajoute : types/colonnes notification, ai_insights, ai_audit_logs,
--          ai_usage, communication_preferences, feature_flags,
--          knowledge_documents, job queue, RLS + index.
-- ============================================================

-- ── 1. Notification : nouveaux types + priorité ───────────
alter type public.notification_type add value if not exists 'risk_detected';
alter type public.notification_type add value if not exists 'performance_drop';
alter type public.notification_type add value if not exists 'attendance_drop';
alter type public.notification_type add value if not exists 'positive_progress';
alter type public.notification_type add value if not exists 'weekly_summary';
alter type public.notification_type add value if not exists 'insight';

create type public.notification_priority as enum ('critical', 'high', 'normal', 'low');

alter table public.notifications
  add column if not exists priority public.notification_priority not null default 'normal';

create index if not exists idx_notifications_user_read
  on public.notifications (user_id, read_at);
create index if not exists idx_notifications_user_type
  on public.notifications (user_id, type);

-- ── 2. ai_insights ─────────────────────────────────────────
create type public.ai_insight_type as enum (
  'attendance_risk',
  'performance_risk',
  'performance_drop',
  'attendance_drop',
  'improvement',
  'positive_trend',
  'class_anomaly',
  'school_anomaly'
);
create type public.ai_severity as enum ('info', 'low', 'medium', 'high', 'critical');
create type public.ai_insight_status as enum ('active', 'acknowledged', 'resolved', 'dismissed');

create table public.ai_insights (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  student_id    uuid references public.students(id) on delete cascade,
  class_id      uuid references public.classes(id) on delete set null,
  type          public.ai_insight_type  not null,
  severity      public.ai_severity      not null default 'info',
  title         text not null,
  summary       text,
  evidence      jsonb not null default '{}'::jsonb,
  recommendation text,
  confidence    numeric(5,2) not null default 0,
  status        public.ai_insight_status not null default 'active',
  dedup_key     text not null,
  generated_at  timestamptz not null default now(),
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.ai_insights is
  'Insights IA / statistiques générés par le Risk Engine. Multi-tenant par school_id.';
comment on column public.ai_insights.dedup_key is
  'Clé de déduplication (ex: school+student+type+fenêtre) pour éviter les alertes répétitives.';

create index idx_ai_insights_school_status     on public.ai_insights (school_id, status);
create index idx_ai_insights_school_severity   on public.ai_insights (school_id, severity desc);
create index idx_ai_insights_student           on public.ai_insights (student_id);
create index idx_ai_insights_class             on public.ai_insights (class_id);
create index idx_ai_insights_dedup             on public.ai_insights (dedup_key);
create index idx_ai_insights_expires           on public.ai_insights (expires_at);
create index idx_ai_insights_generated         on public.ai_insights (generated_at desc);

-- ── 3. ai_audit_logs ───────────────────────────────────────
create table public.ai_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid references public.schools(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete set null,
  action        text not null,
  model         text,
  input_type    text,
  output_type   text,
  latency_ms    integer,
  tokens_used   integer,
  created_at    timestamptz not null default now()
);
comment on table public.ai_audit_logs is
  'Audit des appels IA : métadonnées uniquement (pas de données personnelles brutes).';

create index idx_ai_audit_logs_school on public.ai_audit_logs (school_id, created_at desc);
create index idx_ai_audit_logs_user   on public.ai_audit_logs (user_id);

-- ── 4. ai_usage (quotas par école) ─────────────────────────
create table public.ai_usage (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade unique,
  day             date not null default current_date,
  requests_day    integer not null default 0,
  requests_month  integer not null default 0,
  summaries       integer not null default 0,
  insights        integer not null default 0,
  tokens_used     integer not null default 0,
  updated_at      timestamptz not null default now()
);
comment on table public.ai_usage is
  'Compteurs IA par école (quotas). Permettra des limites par plan.';

-- ── 5. communication_preferences ──────────────────────────
create table public.communication_preferences (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  school_id        uuid references public.schools(id) on delete cascade,
  sms_enabled      boolean not null default false,
  whatsapp_enabled boolean not null default false,
  email_enabled    boolean not null default true,
  push_enabled     boolean not null default true,
  updated_at       timestamptz not null default now(),
  constraint communication_preferences_user_school_unique unique (user_id, school_id)
);
comment on table public.communication_preferences is
  'Consentement aux communications externes (opt-in/opt-out par canal).';

-- ── 6. feature_flags (rollout progressif) ─────────────────
create type public.feature_flag_rollout as enum ('disabled', 'internal', 'pilot', 'beta', 'enabled');

create table public.feature_flags (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  rollout    public.feature_flag_rollout not null default 'disabled',
  school_id  uuid references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.feature_flags is
  'Feature flags globaux (school_id null) ou par école (rollout progressif).';

create index idx_feature_flags_school on public.feature_flags (school_id);

-- ── 7. knowledge_documents (RAG optionnel) ────────────────
create table public.knowledge_documents (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid references public.schools(id) on delete cascade,
  title      text not null,
  content    text not null,
  category   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.knowledge_documents is
  'Documents de connaissance (FAQ/guides). school_id NULL = global, sinon privé à l''école.';

create index idx_knowledge_documents_school on public.knowledge_documents (school_id);
create index idx_knowledge_documents_title   on public.knowledge_documents (title);
create index idx_knowledge_documents_school_title on public.knowledge_documents (school_id, title);

-- Colonne embedding + index vectoriel : ajoutés SEULEMENT si pgvector est dispo
-- (sinon la migration échouerait). La recherche sémantique reste désactivée par défaut.
do $$
begin
  if to_regtype('vector') is not null then
    execute 'alter table public.knowledge_documents add column embedding vector(1536)';
    execute 'create index idx_knowledge_documents_embedding on public.knowledge_documents using hnsw (embedding vector_cosine_ops)';
  end if;
end;
$$;

-- ── 8. ai_job_queue (file de jobs durable) ────────────────
create type public.ai_job_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.ai_job_queue (
  id          uuid primary key default gen_random_uuid(),
  job_type    text not null,
  school_id   uuid references public.schools(id) on delete cascade,
  payload     jsonb not null default '{}'::jsonb,
  status      public.ai_job_status not null default 'pending',
  attempts    integer not null default 0,
  max_attempts integer not null default 3,
  run_at      timestamptz not null default now(),
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.ai_job_queue is
  'File de jobs asynchrones (PGMQ-style simplifiée) : détection, résumés, nettoyage.';

create index idx_ai_job_queue_status_run on public.ai_job_queue (status, run_at);
create index idx_ai_job_queue_school     on public.ai_job_queue (school_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.ai_insights enable row level security;
alter table public.ai_audit_logs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.communication_preferences enable row level security;
alter table public.feature_flags enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.ai_job_queue enable row level security;

-- ai_insights : parent -> ses enfants ; teacher -> ses classes ; admin -> son école ; superadmin -> tout
create policy ai_insights_admin_read on public.ai_insights
  for select using (public.is_admin_of_school(school_id));
create policy ai_insights_superadmin_all on public.ai_insights
  for all using (public.is_super_admin());
create policy ai_insights_teacher_read on public.ai_insights
  for select using (class_id is not null and public.user_teaches_class(class_id));
create policy ai_insights_teacher_student_read on public.ai_insights
  for select using (student_id is not null and exists (
    select 1 from public.class_subjects cs
    join public.teachers t on t.id = cs.teacher_id
    join public.students s on s.id = ai_insights.student_id and s.classroom_id = cs.class_id
    where t.user_id = auth.uid() and t.school_id = ai_insights.school_id
      and s.school_id = ai_insights.school_id
  ));
create policy ai_insights_parent_read on public.ai_insights
  for select using (student_id is not null and public.parent_of_student(student_id));

-- Écriture : uniquement par système (service role) ; l'app n'écrit jamais via le client public.
-- On autorise le school admin à mettre à jour le statut (acknowledged/resolved/dismissed) de ses insights.
create policy ai_insights_admin_status_update on public.ai_insights
  for update using (public.is_admin_of_school(school_id));

-- ai_audit_logs : super admin global
create policy ai_audit_logs_superadmin on public.ai_audit_logs
  for select using (public.is_super_admin());

-- ai_usage : lecture école (admin) + super admin ; écriture système (service role)
create policy ai_usage_admin_read on public.ai_usage
  for select using (public.is_admin_of_school(school_id) or public.is_super_admin());

-- communication_preferences : utilisateur sur lui-même ; super admin global
create policy comm_prefs_own on public.communication_preferences
  for all using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid() or public.is_super_admin());

-- feature_flags : lecture globale ; admin école lit/écrit ses flags ; super admin tout
create policy feature_flags_read_all on public.feature_flags
  for select using (school_id is null or public.is_admin_of_school(school_id) or public.is_super_admin());
create policy feature_flags_superadmin_write on public.feature_flags
  for all using (public.is_super_admin());

-- knowledge_documents : global (libre lecture authentifiée membre) ; école privée = membre de l'école
create policy knowledge_global_read on public.knowledge_documents
  for select using (school_id is null);
create policy knowledge_school_read on public.knowledge_documents
  for select using (school_id is not null and public.is_school_member(auth.uid(), school_id));
create policy knowledge_superadmin_all on public.knowledge_documents
  for all using (public.is_super_admin());

-- ai_job_queue : géré par le système (service role) ; super admin lecture
create policy ai_job_queue_superadmin on public.ai_job_queue
  for select using (public.is_super_admin());

-- ============================================================
-- Helpers / lecteur d'insights
-- ============================================================

-- Nombre d'insights actifs pour un élève (pour notifications / dédup).
create or replace function public.active_student_count_insights(p_student uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*)::bigint from public.ai_insights
  where student_id = p_student and status = 'active'
    and (expires_at is null or expires_at > now());
$$;

-- Vérifie si une clé de déduplication est encore active.
create or replace function public.insight_dedup_active(p_dedup_key text, p_ttl_hours integer default 24)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ai_insights
    where dedup_key = p_dedup_key and status = 'active'
      and generated_at > now() - make_interval(hours => p_ttl_hours)
  );
$$;

-- ============================================================
-- Seed des feature flags par défaut (rollout initial : pilot)
-- ============================================================
insert into public.feature_flags (key, rollout) values
  ('ai_insights', 'pilot'),
  ('ai_assistant', 'pilot'),
  ('ai_summaries', 'pilot'),
  ('semantic_search', 'disabled'),
  ('sms', 'disabled'),
  ('whatsapp', 'disabled'),
  ('weekly_digest', 'beta')
on conflict (key) do nothing;

-- ============================================================
-- Raises
-- ============================================================
do $$
begin
  raise notice 'Phase 8 migration 0018 appliquée : ai_insights + audit + usage + flags + knowledge + jobs.';
end;
$$;
