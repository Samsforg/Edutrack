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