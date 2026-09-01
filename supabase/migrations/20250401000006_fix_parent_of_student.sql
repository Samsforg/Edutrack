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