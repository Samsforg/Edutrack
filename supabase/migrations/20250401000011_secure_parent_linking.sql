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