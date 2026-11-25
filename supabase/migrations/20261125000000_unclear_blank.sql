-- Two more counts when grading, next to right and wrong:
--   unclear (غير مفهوم): an answer whoever is grading could not make out or could not judge, left for the teacher to look at
--   blank   (فاضي):      a question the student left empty
-- Neither counts in the percentage, which stays right answers over right and wrong ones.

alter table public.grades
  add column unclear integer not null default 0 check (unclear >= 0),
  add column blank integer not null default 0 check (blank >= 0);

-- Until now a question that was neither right nor wrong was not written down, and the app showed it as one
-- the student did not answer. That is what blank means, so grades already given keep saying the same thing.
update public.grades g set blank = w.questions - g.correct - g.wrong
from public.submissions s join public.assignments w on w.id = s.assignment_id
where s.id = g.submission_id and w.questions > g.correct + g.wrong;

-- ---------- every count is held to the number of questions ----------

create or replace function public.assignments_fixed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id or new.group_id <> old.group_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'only the title and the number of questions of a homework can change';
  end if;
  if new.questions < old.questions and exists (
    select 1 from grades g join submissions s on s.id = g.submission_id
    where s.assignment_id = new.id and g.correct + g.wrong + g.unclear + g.blank > new.questions) then
    raise exception 'a solution is already graded on more questions than that';
  end if;
  return new;
end $$;

create or replace function public.grades_in_range() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.correct + new.wrong + new.unclear + new.blank > (
    select w.questions from submissions s join assignments w on w.id = s.assignment_id where s.id = new.submission_id) then
    raise exception 'more answers than the homework has questions';
  end if;
  return new;
end $$;

-- ---------- grading in one step, with the two new counts ----------

-- As before; the new counts come last and default to 0, so a call with only right and wrong still works.
drop function public.grade_submission(uuid, integer, integer, text, timestamptz);
create function public.grade_submission(
  sub uuid, n_correct integer, n_wrong integer, teacher_note text, seen timestamptz,
  n_unclear integer default 0, n_blank integer default 0)
returns text language plpgsql set search_path = public as $$
declare
  s submissions;
begin
  select * into s from submissions where id = sub for update;
  if not found then return 'missing'; end if;
  if s.created_at <> seen then return 'changed'; end if;
  if n_correct < 0 or n_wrong < 0 or n_unclear < 0 or n_blank < 0
     or n_correct + n_wrong + n_unclear + n_blank > (select questions from assignments where id = s.assignment_id) then
    return 'range';
  end if;
  insert into grades (submission_id, correct, wrong, unclear, blank, note, graded_by, graded_at)
  values (sub, n_correct, n_wrong, n_unclear, n_blank, left(coalesce(teacher_note, ''), 2000), auth.uid(), now())
  on conflict (submission_id) do update
    set correct = excluded.correct, wrong = excluded.wrong, unclear = excluded.unclear, blank = excluded.blank,
        note = excluded.note, graded_by = excluded.graded_by, graded_at = excluded.graded_at;
  update submissions set status = 'reviewed' where id = sub;
  return 'ok';
exception when insufficient_privilege then
  return 'missing';  -- not theirs to grade; nothing was written
end $$;
revoke execute on function public.grade_submission(uuid, integer, integer, text, timestamptz, integer, integer) from public, anon;
grant execute on function public.grade_submission(uuid, integer, integer, text, timestamptz, integer, integer) to authenticated;

-- ---------- the app needs this version ----------

create or replace function public.schema_version() returns integer
language sql immutable as $$ select 5 $$;
