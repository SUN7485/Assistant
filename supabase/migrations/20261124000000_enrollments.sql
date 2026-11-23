-- A student can be in several groups (one per subject or teacher), with one account.
-- Until now a student had exactly one group and one fee, written on their profile.
--
--   enrollments        : who is in which group
--   groups.monthly_fee : what the group costs each month; special_fees holds the students who pay something else
--   payments           : now one per student, group and month
--   groups.archived_at : last year's groups are put away, not deleted, so their history stays
--   teachers           : see the homework, solutions and grades of their own groups only,
--                        not everything a shared student sends to other teachers
--   notices            : students and teachers can read the ones meant for their groups
--   figures            : attendance and grade totals are counted in the database (views at the end),
--                        so a big centre's screens are not cut off at 1000 rows
--   and the rules the screens relied on are now the database's own: what may change on a homework or a
--   sent solution, grading in one step, no attendance in the future, a limit on stored photos.

-- ---------- enrollments ----------

alter table public.groups
  add column monthly_fee integer not null default 0 check (monthly_fee >= 0),
  add column archived_at timestamptz;

create table public.enrollments (
  student_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (student_id, group_id)
);
create index on public.enrollments (group_id);

-- A student who pays something other than the group's fee (a discount, a sibling). Kept apart from
-- enrollments so that only the manager, and teachers allowed to see payments, can read it.
create table public.special_fees (
  student_id uuid not null,
  group_id uuid not null,
  monthly_fee integer not null check (monthly_fee >= 0),
  primary key (student_id, group_id),
  foreign key (student_id, group_id) references public.enrollments (student_id, group_id) on delete cascade
);

insert into public.enrollments (student_id, group_id, joined_at)
select id, group_id, created_at from public.profiles
where role = 'student' and group_id is not null;

-- The group's fee becomes what most of its students were paying; the others keep theirs as a special fee.
update public.groups g set monthly_fee = coalesce((
  select p.monthly_fee from public.profiles p
  where p.group_id = g.id and p.role = 'student'
  group by p.monthly_fee order by count(*) desc, p.monthly_fee desc limit 1), 0);
insert into public.special_fees (student_id, group_id, monthly_fee)
select p.id, p.group_id, p.monthly_fee from public.profiles p join public.groups g on g.id = p.group_id
where p.role = 'student' and p.monthly_fee <> g.monthly_fee;

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

-- ---------- helpers (security definer so policies don't recurse) ----------

create function public.in_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments where group_id = g and student_id = auth.uid())
$$;

-- A group the student has left stays readable to them where they have history in it.
create function public.was_in_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from attendance where group_id = g and student_id = auth.uid())
      or exists (select 1 from submissions s join assignments w on w.id = s.assignment_id
                 where w.group_id = g and s.student_id = auth.uid())
$$;

create function public.sent_to(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from submissions where assignment_id = a and student_id = auth.uid())
$$;

-- A teacher reads the profile of a student who is in one of their groups, or who has history in one
-- (so the grading and attendance of a student who has since left still have a name on them).
create or replace function public.teaches_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments e join groups g on g.id = e.group_id
                 where e.student_id = s and g.teacher_id = auth.uid())
      or exists (select 1 from attendance t join groups g on g.id = t.group_id
                 where t.student_id = s and g.teacher_id = auth.uid())
      or exists (select 1 from submissions x join assignments w on w.id = x.assignment_id join groups g on g.id = w.group_id
                 where x.student_id = s and g.teacher_id = auth.uid())
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

-- The centre's day: the server's clock is not in Cairo.
create function public.cairo_today() returns date
language sql stable as $$ select (now() at time zone 'Africa/Cairo')::date $$;

-- May this student store a photo at this path? One folder deep, named for a homework of a running group
-- they are in ("<student id>/<assignment id>-<anything>"), and not past 200 photos for that homework.
create function public.solution_slot(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(array_length(storage.foldername(path), 1), 0) = 1
    and (storage.foldername(path))[1] = auth.uid()::text
    and substr(storage.filename(path), 37, 1) = '-'
    and exists (
      select 1 from assignments w join groups g on g.id = w.group_id join enrollments e on e.group_id = g.id
      where w.id::text = left(storage.filename(path), 36) and g.archived_at is null and e.student_id = auth.uid())
    and (select count(*) from storage.objects o
         where o.bucket_id = 'solutions'
           and o.name like auth.uid()::text || '/' || left(storage.filename(path), 36) || '-%') < 200
$$;

-- The app compares this with the version it was built for, and tells the manager which file to run when the database is behind.
create function public.schema_version() returns integer
language sql immutable as $$ select 4 $$;

revoke execute on function
  public.in_group(uuid), public.was_in_group(uuid), public.sent_to(uuid), public.teaches_assignment(uuid),
  public.teaches_submission(uuid), public.cairo_today(), public.solution_slot(text), public.schema_version()
  from public, anon;
grant execute on function
  public.in_group(uuid), public.was_in_group(uuid), public.sent_to(uuid), public.teaches_assignment(uuid),
  public.teaches_submission(uuid), public.cairo_today(), public.solution_slot(text)
  to authenticated;
grant execute on function public.schema_version() to authenticated, service_role;

-- ---------- what may not change, whoever asks ----------

-- A homework keeps its group, its author and its date; and never has fewer questions than a grade already given on it.
create function public.assignments_fixed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id or new.group_id <> old.group_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'only the title and the number of questions of a homework can change';
  end if;
  if new.questions < old.questions and exists (
    select 1 from grades g join submissions s on s.id = g.submission_id
    where s.assignment_id = new.id and g.correct + g.wrong > new.questions) then
    raise exception 'a solution is already graded on more questions than that';
  end if;
  return new;
end $$;
create trigger assignments_fixed before update on public.assignments
  for each row execute function public.assignments_fixed();

-- A grade never counts more answers than the homework has questions.
create function public.grades_in_range() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.correct + new.wrong > (
    select w.questions from submissions s join assignments w on w.id = s.assignment_id where s.id = new.submission_id) then
    raise exception 'more answers than the homework has questions';
  end if;
  return new;
end $$;
create trigger grades_in_range before insert or update on public.grades
  for each row execute function public.grades_in_range();

-- A solution is stamped with the time its pages arrived, by the database, not by whoever sent it.
create function public.submissions_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  return new;
end $$;
create trigger submissions_stamp before insert on public.submissions
  for each row execute function public.submissions_stamp();

-- As before, a sent solution keeps its student and homework, and only its student may change its pages.
-- Now also: new pages mean a new time, and nothing else moves the time.
create or replace function public.submissions_fixed() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id <> old.id or new.student_id <> old.student_id or new.assignment_id <> old.assignment_id
     or (new.photo_paths is distinct from old.photo_paths and old.student_id is distinct from auth.uid()) then
    raise exception 'only the status of a sent solution can change';
  end if;
  new.created_at := case when new.photo_paths is distinct from old.photo_paths then now() else old.created_at end;
  return new;
end $$;

revoke execute on function public.assignments_fixed(), public.grades_in_range(), public.submissions_stamp() from public, anon;

-- ---------- grading in one step ----------

-- Records the grade and marks the solution reviewed together, and only if the solution is still the one
-- the teacher was looking at ("seen" is its time when the grading page was opened). Runs as the caller,
-- so the usual rules decide whether they may grade it at all.
create function public.grade_submission(sub uuid, n_correct integer, n_wrong integer, teacher_note text, seen timestamptz)
returns text language plpgsql set search_path = public as $$
declare
  s submissions;
begin
  select * into s from submissions where id = sub for update;
  if not found then return 'missing'; end if;
  if s.created_at <> seen then return 'changed'; end if;
  if n_correct < 0 or n_wrong < 0
     or n_correct + n_wrong > (select questions from assignments where id = s.assignment_id) then
    return 'range';
  end if;
  insert into grades (submission_id, correct, wrong, note, graded_by, graded_at)
  values (sub, n_correct, n_wrong, left(coalesce(teacher_note, ''), 2000), auth.uid(), now())
  on conflict (submission_id) do update
    set correct = excluded.correct, wrong = excluded.wrong, note = excluded.note,
        graded_by = excluded.graded_by, graded_at = excluded.graded_at;
  update submissions set status = 'reviewed' where id = sub;
  return 'ok';
exception when insufficient_privilege then
  return 'missing';  -- not theirs to grade; nothing was written
end $$;
revoke execute on function public.grade_submission(uuid, integer, integer, text, timestamptz) from public, anon;
grant execute on function public.grade_submission(uuid, integer, integer, text, timestamptz) to authenticated;

-- A login left without a profile (making the account was cut off halfway) blocks its phone number for good.
-- The server removes it before trying again. Server only.
create function public.drop_orphan_login(mail text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users u where u.email = mail and not exists (select 1 from profiles p where p.id = u.id);
  return found;
end $$;
revoke execute on function public.drop_orphan_login(text) from public, anon, authenticated;
grant execute on function public.drop_orphan_login(text) to service_role;

-- ---------- row-level security ----------

alter table public.enrollments enable row level security;
alter table public.special_fees enable row level security;

-- Students are put in groups by the server, after it has checked who is asking; in the database only the manager may.
create policy enrollments_read on public.enrollments for select to authenticated
  using (is_admin() or student_id = auth.uid() or teaches_group(group_id));
create policy enrollments_admin_write on public.enrollments for all to authenticated
  using (is_admin()) with check (is_admin());

create policy special_fees_read on public.special_fees for select to authenticated
  using (is_admin() or (teaches_group(group_id) and teacher_can('payments')));
create policy special_fees_admin_write on public.special_fees for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated
  using (is_admin() or teacher_id = auth.uid() or in_group(id) or was_in_group(id));

drop policy assignments_read on public.assignments;
create policy assignments_read on public.assignments for select to authenticated
  using (is_admin() or teaches_group(group_id) or in_group(group_id) or sent_to(id));
-- Fixing a title or the number of questions (assignments_fixed holds the rest still).
create policy assignments_update on public.assignments for update to authenticated
  using (is_admin() or teaches_group(group_id))
  with check (is_admin() or teaches_group(group_id));

drop policy attendance_insert on public.attendance;
drop policy attendance_update on public.attendance;
create policy attendance_insert on public.attendance for insert to authenticated
  with check (
    (is_admin() or (teaches_group(group_id) and teacher_can('attendance') and recorded_by = auth.uid()))
    and day <= cairo_today()
    and exists (select 1 from enrollments e where e.student_id = attendance.student_id and e.group_id = attendance.group_id));
create policy attendance_update on public.attendance for update to authenticated
  using (is_admin() or (teaches_group(group_id) and teacher_can('attendance')))
  with check (
    (is_admin() or (teaches_group(group_id) and teacher_can('attendance') and recorded_by = auth.uid()))
    and day <= cairo_today()
    and exists (select 1 from enrollments e where e.student_id = attendance.student_id and e.group_id = attendance.group_id));
-- A class written on the wrong day can be taken back: by a teacher within two weeks, by the manager any time.
create policy attendance_delete on public.attendance for delete to authenticated
  using (is_admin() or (teaches_group(group_id) and teacher_can('attendance') and day >= cairo_today() - 14));

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
    and exists (select 1 from assignments a join groups g on g.id = a.group_id
                where a.id = assignment_id and g.archived_at is null and in_group(a.group_id)));
create policy submissions_student_resend on public.submissions for update to authenticated
  using (student_id = auth.uid() and status = 'new')
  with check (
    student_id = auth.uid() and status = 'new'
    and own_pages(photo_paths, assignment_id)
    and exists (select 1 from assignments a join groups g on g.id = a.group_id
                where a.id = assignment_id and g.archived_at is null and in_group(a.group_id)));
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

-- Only people of the centre: a login with no profile reads nothing.
create policy notices_read on public.notices for select to authenticated
  using (my_role() is not null and (group_id is null or in_group(group_id) or teaches_group(group_id)));

-- Photos: a student stores pages for their own homework (solution_slot); a teacher opens the pages of homework they set.
drop policy solutions_student_upload on storage.objects;
create policy solutions_student_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'solutions' and my_role() = 'student' and solution_slot(name));
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

-- ---------- figures, counted here ----------
-- These run as whoever asks (security_invoker), so each person's totals cover only the rows they may read:
-- a student gets their own attendance and no grades; a teacher gets their own groups.

-- Each student in each group: classes and how they went, and their grades there.
-- A grade's percentage is right answers over answered questions, rounded; the average is of those, rounded.
create view public.student_stats with (security_invoker = true) as
select e.student_id, e.group_id,
  coalesce(a.classes, 0) as classes, coalesce(a.present, 0) as present,
  coalesce(a.late, 0) as late, coalesce(a.absent, 0) as absent,
  coalesce(m.graded, 0) as graded, m.average
from public.enrollments e
left join lateral (
  select count(*)::int as classes,
         count(*) filter (where t.status = 'present')::int as present,
         count(*) filter (where t.status = 'late')::int as late,
         count(*) filter (where t.status = 'absent')::int as absent
  from public.attendance t where t.student_id = e.student_id and t.group_id = e.group_id) a on true
left join lateral (
  select count(*)::int as graded,
         round(avg(round(100.0 * g.correct / greatest(1, g.correct + g.wrong))))::int as average
  from public.grades g join public.submissions s on s.id = g.submission_id join public.assignments w on w.id = s.assignment_id
  where s.student_id = e.student_id and w.group_id = e.group_id) m on true;

-- Each homework: how many of the group's current students have sent a solution, and how many are still to grade.
create view public.homework_counts with (security_invoker = true) as
select w.id as assignment_id, w.group_id,
  count(e.student_id)::int as sent,
  count(e.student_id) filter (where s.status = 'new')::int as waiting
from public.assignments w
left join public.submissions s on s.assignment_id = w.id
left join public.enrollments e on e.student_id = s.student_id and e.group_id = w.group_id
group by w.id, w.group_id;

-- Each group's most recent class: how many were on the roll and how many came.
create view public.last_class with (security_invoker = true) as
select t.group_id, t.day, count(*)::int as total, count(*) filter (where t.status <> 'absent')::int as came
from public.attendance t
join (select group_id, max(day) as day from public.attendance group by group_id) l on l.group_id = t.group_id and l.day = t.day
group by t.group_id, t.day;

-- Students absent from the last two classes (in the last 45 days) of a group they are still in.
create view public.absent_twice with (security_invoker = true) as
select x.student_id, x.group_id
from (
  select t.student_id, t.group_id, t.status,
         row_number() over (partition by t.student_id, t.group_id order by t.day desc) as n
  from public.attendance t
  where t.day >= public.cairo_today() - 45) x
join public.enrollments e on e.student_id = x.student_id and e.group_id = x.group_id
where x.n <= 2
group by x.student_id, x.group_id
having count(*) = 2 and bool_and(x.status = 'absent');

revoke all on public.student_stats, public.homework_counts, public.last_class, public.absent_twice from anon;
