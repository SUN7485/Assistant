-- A solution can be several pages: photo_path (one photo) becomes photo_paths (1 to 10 photos, in page order).

alter table public.submissions add column photo_paths text[];
update public.submissions set photo_paths = array[photo_path];

-- As before: a sent solution keeps its student and homework; only its student may change its pages.
create or replace function public.submissions_fixed() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.student_id <> old.student_id or new.assignment_id <> old.assignment_id
     or (new.photo_paths is distinct from old.photo_paths and old.student_id is distinct from auth.uid()) then
    raise exception 'only the status of a sent solution can change';
  end if;
  return new;
end $$;

-- The two policies that read photo_path go before the column does, and come back below.
drop policy submissions_student_insert on public.submissions;
drop policy submissions_student_resend on public.submissions;

alter table public.submissions
  drop column photo_path,
  alter column photo_paths set not null,
  add constraint submissions_pages
    check (cardinality(photo_paths) between 1 and 10 and array_position(photo_paths, null) is null);

-- Every page is "<student id>/<assignment id>-<anything>": in the student's own folder, and belonging
-- to this homework, so one solution can never point at the photos of another.
create function public.own_pages(paths text[], assignment uuid) returns boolean
language sql stable set search_path = public as $$
  select not exists (
    select 1 from unnest(paths) p
    where p is null or not starts_with(p, auth.uid()::text || '/' || assignment::text || '-'))
$$;
revoke execute on function public.own_pages(text[], uuid) from public, anon;
grant execute on function public.own_pages(text[], uuid) to authenticated;

create policy submissions_student_insert on public.submissions for insert to authenticated
  with check (
    student_id = auth.uid() and status = 'new'
    and own_pages(photo_paths, assignment_id)
    and exists (select 1 from assignments a where a.id = assignment_id and a.group_id = my_group()));
create policy submissions_student_resend on public.submissions for update to authenticated
  using (student_id = auth.uid() and status = 'new')
  with check (
    student_id = auth.uid() and status = 'new'
    and own_pages(photo_paths, assignment_id)
    and exists (select 1 from assignments a where a.id = assignment_id and a.group_id = my_group()));
