-- A student can be in several groups (one per subject or teacher), each with its own monthly fee.
-- Until now a student had exactly one group, written on their profile.
--
--   enrollments        : who is in which group, and what they pay for it each month
--   payments           : now one per student, group and month
--   groups.archived_at : last year's groups are put away, not deleted, so their history stays
--   teachers           : see the homework, solutions and grades of their own groups only,
--                        not everything a shared student sends to other teachers
--   notices            : students and teachers can read the ones meant for their groups

-- ---------- enrollments ----------

create table public.enrollments (
  student_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  monthly_fee integer not null default 0 check (monthly_fee >= 0),
  joined_at timestamptz not null default now(),
  primary key (student_id, group_id)
);
create index on public.enrollments (group_id);

insert into public.enrollments (student_id, group_id, monthly_fee, joined_at)
select id, group_id, monthly_fee, created_at from public.profiles
where role = 'student' and group_id is not null;

-- Only students are enrolled. Security definer, because the person adding may not be allowed to read that profile yet.
create function public.enrollments_students_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = new.student_id and role = 'student') then
    raise exception 'only a student can be put in a group';
  end if;
  return new;
end $$;
revoke execute on function public.enrollments_students_only() from public, anon;
create trigger enrollments_students_only before insert or update on public.enrollments
  for each row execute function public.enrollments_students_only();

-- ---------- payments: per group ----------

alter table public.payments add column group_id uuid references public.groups (id) on delete restrict;
update public.payments p set group_id = s.group_id from public.profiles s where s.id = p.student_id;
-- A payment of a student who was in no group cannot be placed; the app never made one.
delete from public.payments where group_id is null;
alter table public.payments
  drop constraint payments_pkey,
  alter column group_id set not null,
  add primary key (student_id, group_id, month);
create index on public.payments (month);

alter table public.groups add column archived_at timestamptz;

-- ---------- helpers ----------

create function public.in_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments where group_id = g and student_id = auth.uid())
$$;

-- A teacher "teaches" a student who is in at least one of their groups.
create or replace function public.teaches_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments e join groups g on g.id = e.group_id
    where e.student_id = s and g.teacher_id = auth.uid())
$$;

create function public.teaches_assignment(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments w join groups g on g.id = w.group_id
    where w.id = a and g.teacher_id = auth.uid())
$$;

create function public.teaches_submission(sub uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from submissions s join assignments w on w.id = s.assignment_id join groups g on g.id = w.group_id
    where s.id = sub and g.teacher_id = auth.uid())
$$;

create or replace function public.teacher_can(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case perm
      when 'attendance' then can_attendance
      when 'grade' then can_grade
      when 'payments' then can_see_payments
      when 'add_students' then can_add_students
      else false end
    from profiles where id = auth.uid() and role = 'teacher'), false)
$$;

-- The app compares this with the version it was built for, and tells the manager which file to run when the database is behind.
create function public.schema_version() returns integer
language sql immutable as $$ select 4 $$;

revoke execute on function public.in_group(uuid), public.teaches_assignment(uuid), public.teaches_submission(uuid) from public, anon;
grant execute on function public.in_group(uuid), public.teaches_assignment(uuid), public.teaches_submission(uuid) to authenticated;
revoke execute on function public.schema_version() from public, anon;
grant execute on function public.schema_version() to authenticated, service_role;

-- ---------- row-level security ----------

alter table public.enrollments enable row level security;

create policy enrollments_read on public.enrollments for select to authenticated
  using (is_admin() or student_id = auth.uid() or teaches_group(group_id));
-- A teacher allowed to add students puts them in their own groups; fees and removals stay with the manager.
create policy enrollments_insert on public.enrollments for insert to authenticated
  with check (is_admin() or (teaches_group(group_id) and teacher_can('add_students')));
create policy enrollments_admin_update on public.enrollments for update to authenticated
  using (is_admin()) with check (is_admin());
create policy enrollments_admin_delete on public.enrollments for delete to authenticated
  using (is_admin());

drop policy groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated
  using (is_admin() or teacher_id = auth.uid() or in_group(id));

drop policy assignments_read on public.assignments;
create policy assignments_read on public.assignments for select to authenticated
  using (is_admin() or teaches_group(group_id) or in_group(group_id));
-- Fixing a title or the number of questions.
create policy assignments_update on public.assignments for update to authenticated
  using (is_admin() or teaches_group(group_id))
  with check (is_admin() or teaches_group(group_id));

drop policy attendance_insert on public.attendance;
drop policy attendance_update on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated
  with check (
    (is_admin() or (teaches_group(group_id) and teacher_can('attendance') and recorded_by = auth.uid()))
    and exists (select 1 from enrollments e where e.student_id = attendance.student_id and e.group_id = attendance.group_id));
create policy attendance_update on public.attendance for update to authenticated
  using (is_admin() or (teaches_group(group_id) and teacher_can('attendance')))
  with check (
    (is_admin() or (teaches_group(group_id) and teacher_can('attendance') and recorded_by = auth.uid()))
    and exists (select 1 from enrollments e where e.student_id = attendance.student_id and e.group_id = attendance.group_id));
-- A class written on the wrong day can be taken back.
create policy attendance_delete on public.attendance for delete to authenticated
  using (is_admin() or (teaches_group(group_id) and teacher_can('attendance')));

drop policy submissions_read on public.submissions;
drop policy submissions_student_insert on public.submissions;
drop policy submissions_student_resend on public.submissions;
drop policy submissions_review on public.submissions;
create policy submissions_read on public.submissions for select to authenticated
  using (is_admin() or student_id = auth.uid() or teaches_assignment(assignment_id));
create policy submissions_student_insert on public.submissions for insert to authenticated
  with check (
    student_id = auth.uid() and status = 'new'
    and own_pages(photo_paths, assignment_id)
    and exists (select 1 from assignments a where a.id = assignment_id and in_group(a.group_id)));
create policy submissions_student_resend on public.submissions for update to authenticated
  using (student_id = auth.uid() and status = 'new')
  with check (
    student_id = auth.uid() and status = 'new'
    and own_pages(photo_paths, assignment_id)
    and exists (select 1 from assignments a where a.id = assignment_id and in_group(a.group_id)));
create policy submissions_review on public.submissions for update to authenticated
  using (is_admin() or (teaches_assignment(assignment_id) and teacher_can('grade')))
  with check (is_admin() or (teaches_assignment(assignment_id) and teacher_can('grade')));

drop policy grades_read on public.grades;
drop policy grades_insert on public.grades;
drop policy grades_update on public.grades;
create policy grades_read on public.grades for select to authenticated
  using (is_admin() or teaches_submission(submission_id));
create policy grades_insert on public.grades for insert to authenticated
  with check (is_admin() or (teaches_submission(submission_id) and teacher_can('grade') and graded_by = auth.uid()));
create policy grades_update on public.grades for update to authenticated
  using (is_admin() or (teaches_submission(submission_id) and teacher_can('grade')))
  with check (is_admin() or (teaches_submission(submission_id) and teacher_can('grade') and graded_by = auth.uid()));

drop policy payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
  using (is_admin() or (teaches_group(group_id) and teacher_can('payments')));

create policy notices_read on public.notices for select to authenticated
  using (group_id is null or in_group(group_id) or teaches_group(group_id));

-- Photos: a teacher opens the pages of homework they set. A page is "<student id>/<assignment id>-<anything>".
drop policy solutions_read on storage.objects;
create policy solutions_read on storage.objects for select to authenticated
  using (bucket_id = 'solutions' and (
    is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from assignments w join groups g on g.id = w.group_id
      where w.id::text = left(storage.filename(objects.name), 36) and g.teacher_id = auth.uid())));

-- ---------- the old one-group columns go ----------

drop function public.my_group();
drop function public.submission_student(uuid);
alter table public.profiles drop column group_id, drop column monthly_fee;
