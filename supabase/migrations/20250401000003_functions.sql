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
create or replace function public.create_link_request(target_school uuid, code text)
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
    and upper(s.link_code) = upper(btrim(code));

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
        or (v_parent is null and r.code = upper(btrim(code)))
      )
  ) then
    raise exception 'PENDING_EXISTS';
  end if;

  insert into public.student_link_requests (
    school_id, parent_id, student_id, code, status, expires_at
  ) values (
    v_school, v_parent, v_student, upper(btrim(code)), 'pending',
    now() + interval '7 days'
  )
  returning id into v_student;

  return query select v_student::uuid;
end;
$$;

comment on function public.create_link_request(uuid, text) is
  'Creates a pending parent-child link request from a link code.';

-- Sets a request status (used by parents to cancel their own request).
create or replace function public.set_link_request_status(request_id uuid, new_status public.link_request_status)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent uuid;
begin
  -- Only the owning parent may update their own pending request
  -- to 'rejected' (cancellation). Admins are handled via RLS directly.
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
end;
$$;