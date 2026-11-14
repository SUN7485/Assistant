-- Tightening after the review of 14 Nov 2026.

-- One manager only, so two first-run forms sent at once cannot both make one.
create unique index one_admin on public.profiles ((true)) where role = 'admin';

-- Attendance: the student must be in the group the row is for.
drop policy attendance_insert on public.attendance;
drop policy attendance_update on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated
  with check (
    (is_admin() or (teaches_group(group_id) and teacher_can('attendance') and recorded_by = auth.uid()))
    and exists (select 1 from profiles p where p.id = student_id and p.group_id = attendance.group_id and p.role = 'student'));
create policy attendance_update on public.attendance for update to authenticated
  using (is_admin() or (teaches_group(group_id) and teacher_can('attendance')))
  with check (
    (is_admin() or (teaches_group(group_id) and teacher_can('attendance') and recorded_by = auth.uid()))
    and exists (select 1 from profiles p where p.id = student_id and p.group_id = attendance.group_id and p.role = 'student'));

-- Homework: a teacher writes it under their own name; only the manager deletes it (it takes the solutions and grades with it).
drop policy assignments_insert on public.assignments;
drop policy assignments_delete on public.assignments;
create policy assignments_insert on public.assignments for insert to authenticated
  with check (is_admin() or (teaches_group(group_id) and created_by = auth.uid()));
create policy assignments_delete on public.assignments for delete to authenticated
  using (is_admin());

-- Grades: a teacher grades under their own name.
drop policy grades_insert on public.grades;
drop policy grades_update on public.grades;
create policy grades_insert on public.grades for insert to authenticated
  with check (is_admin() or (teaches_student(submission_student(submission_id)) and teacher_can('grade') and graded_by = auth.uid()));
create policy grades_update on public.grades for update to authenticated
  using (is_admin() or (teaches_student(submission_student(submission_id)) and teacher_can('grade')))
  with check (is_admin() or (teaches_student(submission_student(submission_id)) and teacher_can('grade') and graded_by = auth.uid()));

-- A sent solution keeps its student and homework; only its student may change its photo. The teacher changes the status only.
create function public.submissions_fixed() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.student_id <> old.student_id or new.assignment_id <> old.assignment_id
     or (new.photo_path <> old.photo_path and old.student_id is distinct from auth.uid()) then
    raise exception 'only the status of a sent solution can change';
  end if;
  return new;
end $$;
revoke execute on function public.submissions_fixed() from public, anon;
create trigger submissions_fixed before update on public.submissions
  for each row execute function public.submissions_fixed();
