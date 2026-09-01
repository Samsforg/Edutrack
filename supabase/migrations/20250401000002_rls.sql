-- ============================================================
-- EduTrack :: 0003_rls.sql
-- Row Level Security policies.
-- Core rule: a user can only ever access data of schools they
-- belong to. Parents only access their own children's data.
-- ============================================================

-- Additional helpers used by policies ------------------------

-- True when the current authenticated user teaches the given class.
create or replace function public.user_teaches_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_subjects cs
    join public.teachers t on t.id = cs.teacher_id
    join public.school_members sm on sm.user_id = t.user_id and sm.school_id = t.school_id
    where cs.class_id = target_class
      and t.user_id = auth.uid()
      and sm.role = 'TEACHER'
  );
$$;

-- True when the current user is SCHOOL_ADMIN of a school that
-- owns the given object's school relation.
create or replace function public.is_admin_of_school(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_role(target_school, 'SCHOOL_ADMIN');
$$;

-- ============================================================
-- Enable RLS everywhere
-- ============================================================

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.teachers enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.student_parents enable row level security;
alter table public.attendance enable row level security;
alter table public.grades enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.student_link_requests enable row level security;

-- ============================================================
-- profiles
-- ============================================================
create policy "profiles_select_own_or_school_peer" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.school_members v
      join public.school_members t on t.school_id = v.school_id
      where v.user_id = auth.uid() and t.user_id = profiles.id
        and not exists (
          select 1 from public.school_members p
          where p.user_id = auth.uid() and p.role = 'PARENT'
        )
    )
  );

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- schools
-- ============================================================
create policy "schools_select_member" on public.schools
  for select to authenticated
  using (public.is_school_member(auth.uid(), id) or public.is_super_admin());

create policy "schools_admin_write" on public.schools
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ============================================================
-- school_members
-- ============================================================
create policy "members_select_non_parent" on public.school_members
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_school_member(auth.uid(), school_id)
      and not exists (
        select 1 from public.school_members me
        where me.user_id = auth.uid() and me.school_id = school_members.school_id
          and me.role = 'PARENT'
      )
    )
  );

create policy "members_admin_manage" on public.school_members
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- academic_years
-- ============================================================
create policy "academic_years_select_member" on public.academic_years
  for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

create policy "academic_years_admin_write" on public.academic_years
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- classes
-- ============================================================
create policy "classes_select_member" on public.classes
  for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

create policy "classes_admin_write" on public.classes
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- teachers
-- ============================================================
create policy "teachers_select_member" on public.teachers
  for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

create policy "teachers_admin_write" on public.teachers
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- subjects
-- ============================================================
create policy "subjects_select_member" on public.subjects
  for select to authenticated
  using (public.is_school_member(auth.uid(), school_id) or public.is_super_admin());

create policy "subjects_admin_write" on public.subjects
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- class_subjects
-- ============================================================
create policy "class_subjects_select_member" on public.class_subjects
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.classes c
      where c.id = class_subjects.class_id
        and public.is_school_member(auth.uid(), c.school_id)
    )
  );

create policy "class_subjects_admin_write" on public.class_subjects
  for all to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_subjects.class_id
        and (public.is_admin_of_school(c.school_id) or public.user_teaches_class(c.id))
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_subjects.class_id
        and (public.is_admin_of_school(c.school_id) or public.user_teaches_class(c.id))
    )
  );

-- ============================================================
-- students
-- ============================================================
create policy "students_select_member_or_linked_parent" on public.students
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_school_member(auth.uid(), school_id)
    or public.parent_of_student(id)
  );

create policy "students_admin_write" on public.students
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- parents
-- ============================================================
create policy "parents_select_member" on public.parents
  for select to authenticated
  using (
    public.is_super_admin()
    or public.is_school_member(auth.uid(), school_id)
    or user_id = auth.uid()
  );

create policy "parents_admin_write" on public.parents
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- student_parents
-- ============================================================
create policy "student_parents_select" on public.student_parents
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or exists (
      select 1 from public.students s
      where s.id = student_parents.student_id
        and public.is_school_member(auth.uid(), s.school_id)
    )
  );

create policy "student_parents_admin_write" on public.student_parents
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_parents.student_id
        and (public.is_admin_of_school(s.school_id) or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_parents.student_id
        and (public.is_admin_of_school(s.school_id) or public.is_super_admin())
    )
  );

-- ============================================================
-- attendance
-- ============================================================
create policy "attendance_select" on public.attendance
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or public.is_school_member(auth.uid(), school_id)
  );

create policy "attendance_write" on public.attendance
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id
        and (
          public.is_admin_of_school(s.school_id)
          or (classroom_id is not null and public.user_teaches_class(classroom_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id
        and (
          public.is_admin_of_school(s.school_id)
          or (classroom_id is not null and public.user_teaches_class(classroom_id))
        )
    )
  );

-- ============================================================
-- grades
-- ============================================================
create policy "grades_select" on public.grades
  for select to authenticated
  using (
    public.is_super_admin()
    or public.parent_of_student(student_id)
    or public.is_school_member(auth.uid(), school_id)
  );

create policy "grades_write" on public.grades
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = grades.student_id
        and (
          public.is_admin_of_school(s.school_id)
          or (classroom_id is not null and public.user_teaches_class(classroom_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = grades.student_id
        and (
          public.is_admin_of_school(s.school_id)
          or (classroom_id is not null and public.user_teaches_class(classroom_id))
        )
    )
  );

-- ============================================================
-- announcements
-- ============================================================
create policy "announcements_select" on public.announcements
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_school_member(auth.uid(), school_id)
      and (
        audience = 'all'
        or (
          audience = 'class'
          and (
            public.is_admin_of_school(school_id)
            or public.user_teaches_class(classroom_id)
            or exists (
              select 1
              from public.student_parents sp
              join public.students s on s.id = sp.student_id
              join public.parents p on p.id = sp.parent_id
              where s.classroom_id = announcements.classroom_id
                and p.user_id = auth.uid()
            )
          )
        )
      )
    )
  );

create policy "announcements_admin_write" on public.announcements
  for all to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin())
  with check (public.is_admin_of_school(school_id) or public.is_super_admin());

-- ============================================================
-- notifications
-- ============================================================
create policy "notifications_own" on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- student_link_requests
-- ============================================================
create policy "link_requests_select" on public.student_link_requests
  for select to authenticated
  using (
    public.is_admin_of_school(school_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.parents p
      where p.id = student_link_requests.parent_id and p.user_id = auth.uid()
    )
  );

-- Parents create their own link requests (must be a parent in the school, or providing the code confirms the child).
create policy "link_requests_parent_insert" on public.student_link_requests
  for insert to authenticated
  with check (
    parent_id is null
    or exists (
      select 1 from public.parents p
      where p.id = parent_id and p.user_id = auth.uid()
    )
  );

create policy "link_requests_admin_update" on public.student_link_requests
  for update to authenticated
  using (
    public.is_admin_of_school(school_id)
    or public.is_super_admin()
    or exists (
      select 1 from public.parents p
      where p.id = parent_id and p.user_id = auth.uid() and status = 'pending'
    )
  )
  with check (true);

create policy "link_requests_admin_delete" on public.student_link_requests
  for delete to authenticated
  using (public.is_admin_of_school(school_id) or public.is_super_admin());
