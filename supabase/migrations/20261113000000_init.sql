-- Assistant: tutoring-centre platform.
-- Who sees what is decided here, by row-level security, not by the screens:
--   admin   : everything
--   teacher : only the groups they teach, and only what their permissions allow
--   student : their own attendance, their own assignments and uploads; never grades or notes

-- ---------- tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student')),
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  phone text not null unique check (phone ~ '^01[0-9]{9}$'),
  subject text,                                   -- teacher
  group_id uuid,                                  -- student
  parent_phone text check (parent_phone ~ '^01[0-9]{9}$'),
  monthly_fee integer not null default 0 check (monthly_fee >= 0),
  can_attendance boolean not null default true,   -- teacher permissions
  can_grade boolean not null default true,
  can_add_students boolean not null default false,
  can_see_payments boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  teacher_id uuid not null references public.profiles (id),
  schedule text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_group_fk foreign key (group_id) references public.groups (id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 120),
  questions integer not null check (questions between 1 and 200),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.attendance (
  group_id uuid not null references public.groups (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  status text not null check (status in ('present', 'late', 'absent')),
  recorded_by uuid not null default auth.uid() references public.profiles (id),
  recorded_at timestamptz not null default now(),
  primary key (group_id, student_id, day)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  photo_path text not null,
  status text not null default 'new' check (status in ('new', 'reviewed')),
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- Kept apart from submissions so a student can read their submission's status and nothing else.
create table public.grades (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  correct integer not null check (correct >= 0),
  wrong integer not null check (wrong >= 0),
  note text not null default '' check (length(note) <= 2000),
  graded_by uuid not null default auth.uid() references public.profiles (id),
  graded_at timestamptz not null default now()
);

create table public.payments (
  student_id uuid not null references public.profiles (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount integer not null check (amount >= 0),
  recorded_by uuid not null default auth.uid() references public.profiles (id),
  paid_at timestamptz not null default now(),
  primary key (student_id, month)
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,  -- null = every group
  body text not null check (length(trim(body)) between 1 and 1000),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

create index on public.profiles (group_id);
create index on public.groups (teacher_id);
create index on public.assignments (group_id);
create index on public.attendance (student_id, day desc);
create index on public.submissions (student_id);
create index on public.submissions (status, created_at desc);

-- ---------- helpers (security definer so policies don't recurse through profiles) ----------

create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false)
$$;

create function public.my_group() returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from profiles where id = auth.uid() and role = 'student'
$$;

create function public.teaches_group(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = g and teacher_id = auth.uid())
$$;

create function public.teaches_student(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join groups g on g.id = p.group_id
    where p.id = s and p.role = 'student' and g.teacher_id = auth.uid())
$$;

-- A teacher's permission flag; false for anyone who is not a teacher.
create function public.teacher_can(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case perm
      when 'attendance' then can_attendance
      when 'grade' then can_grade
      when 'payments' then can_see_payments
      else false end
    from profiles where id = auth.uid() and role = 'teacher'), false)
$$;

create function public.submission_student(sub uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select student_id from submissions where id = sub
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------- row-level security ----------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.assignments enable row level security;
alter table public.attendance enable row level security;
alter table public.submissions enable row level security;
alter table public.grades enable row level security;
alter table public.payments enable row level security;
alter table public.notices enable row level security;

-- profiles: new accounts are made by the server (service role) after it checks the caller.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or is_admin() or teaches_student(id));
create policy profiles_admin_update on public.profiles for update to authenticated
  using (is_admin()) with check (is_admin());

create policy groups_read on public.groups for select to authenticated
  using (is_admin() or teacher_id = auth.uid() or id = my_group());
create policy groups_admin_write on public.groups for all to authenticated
  using (is_admin()) with check (is_admin());

create policy assignments_read on public.assignments for select to authenticated
  using (is_admin() or teaches_group(group_id) or group_id = my_group());
create policy assignments_insert on public.assignments for insert to authenticated
  with check (is_admin() or teaches_group(group_id));
create policy assignments_delete on public.assignments for delete to authenticated
  using (is_admin() or teaches_group(group_id));

create policy attendance_read on public.attendance for select to authenticated
  using (is_admin() or teaches_group(group_id) or student_id = auth.uid());
create policy attendance_insert on public.attendance for insert to authenticated
  with check (is_admin() or (teaches_group(group_id) and teacher_can('attendance')));
create policy attendance_update on public.attendance for update to authenticated
  using (is_admin() or (teaches_group(group_id) and teacher_can('attendance')))
  with check (is_admin() or (teaches_group(group_id) and teacher_can('attendance')));

-- submissions: a student sends and may resend until it is reviewed; the teacher marks it reviewed.
create policy submissions_read on public.submissions for select to authenticated
  using (is_admin() or student_id = auth.uid() or teaches_student(student_id));
create policy submissions_student_insert on public.submissions for insert to authenticated
  with check (
    student_id = auth.uid() and status = 'new'
    and photo_path like auth.uid()::text || '/%'
    and exists (select 1 from assignments a where a.id = assignment_id and a.group_id = my_group()));
create policy submissions_student_resend on public.submissions for update to authenticated
  using (student_id = auth.uid() and status = 'new')
  with check (
    student_id = auth.uid() and status = 'new'
    and photo_path like auth.uid()::text || '/%'
    and exists (select 1 from assignments a where a.id = assignment_id and a.group_id = my_group()));
create policy submissions_review on public.submissions for update to authenticated
  using (is_admin() or (teaches_student(student_id) and teacher_can('grade')))
  with check (is_admin() or (teaches_student(student_id) and teacher_can('grade')));

-- grades: never readable by students.
create policy grades_read on public.grades for select to authenticated
  using (is_admin() or teaches_student(submission_student(submission_id)));
create policy grades_insert on public.grades for insert to authenticated
  with check (is_admin() or (teaches_student(submission_student(submission_id)) and teacher_can('grade')));
create policy grades_update on public.grades for update to authenticated
  using (is_admin() or (teaches_student(submission_student(submission_id)) and teacher_can('grade')))
  with check (is_admin() or (teaches_student(submission_student(submission_id)) and teacher_can('grade')));

create policy payments_read on public.payments for select to authenticated
  using (is_admin() or (teaches_student(student_id) and teacher_can('payments')));
create policy payments_admin_write on public.payments for all to authenticated
  using (is_admin()) with check (is_admin());

create policy notices_admin on public.notices for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- photo storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solutions', 'solutions', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Paths are "<student id>/<assignment id>-<time>.jpg".
create policy solutions_student_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'solutions' and my_role() = 'student'
    and (storage.foldername(name))[1] = auth.uid()::text);
create policy solutions_read on storage.objects for select to authenticated
  using (bucket_id = 'solutions' and (
    is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from profiles p join groups g on g.id = p.group_id
      where p.id::text = (storage.foldername(objects.name))[1] and g.teacher_id = auth.uid())));  -- objects.name: groups has a name too
