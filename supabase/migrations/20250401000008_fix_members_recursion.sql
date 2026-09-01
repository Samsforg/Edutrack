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