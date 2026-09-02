-- ============================================================
-- EduTrack :: 0010_school_admin_update_policy.sql
-- Allows a SCHOOL_ADMIN to update their OWN school's record
-- (name + contact details) through RLS.
-- SUPER_ADMIN keeps full access via schools_admin_write.
-- ============================================================

create policy "schools_admin_update_own" on public.schools
  for update to authenticated
  using (public.is_admin_of_school(id) or public.is_super_admin())
  with check (public.is_admin_of_school(id) or public.is_super_admin());