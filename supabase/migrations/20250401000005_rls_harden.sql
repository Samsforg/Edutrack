-- ============================================================
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
-- rosters through students. Covered above by role exclusion.