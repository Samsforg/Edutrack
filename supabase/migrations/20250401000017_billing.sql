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
