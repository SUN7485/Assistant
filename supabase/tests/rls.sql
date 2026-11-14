-- Proves who can see and change what. Runs inside a transaction and rolls back.
-- npm run test:rls   (needs `npx supabase start`)
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 't1@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 't2@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 's1@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 's2@test.invalid', 'authenticated', 'authenticated');

insert into profiles (id, role, full_name, phone, can_grade, can_attendance, can_see_payments) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', '01000000001', false, false, false),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher', 'Teacher One', '01000000002', true, true, false),
  ('00000000-0000-0000-0000-0000000000b2', 'teacher', 'Teacher Two', '01000000003', false, false, false);
insert into groups (id, name, teacher_id) values
  ('00000000-0000-0000-0000-0000000000d1', 'Group One', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d2', 'Group Two', '00000000-0000-0000-0000-0000000000b2');
insert into profiles (id, role, full_name, phone, group_id) values
  ('00000000-0000-0000-0000-0000000000c1', 'student', 'Student One', '01000000004', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000c2', 'student', 'Student Two', '01000000005', '00000000-0000-0000-0000-0000000000d2');
insert into assignments (id, group_id, title, questions, created_by) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Work One', 10, '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 'Work Two', 10, '00000000-0000-0000-0000-0000000000b2');
insert into submissions (id, assignment_id, student_id, photo_path) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1/one.jpg'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c2/two.jpg');
insert into grades (submission_id, correct, wrong, note, graded_by) values
  ('00000000-0000-0000-0000-0000000000f1', 7, 3, 'check question 4', '00000000-0000-0000-0000-0000000000b1');
insert into attendance (group_id, student_id, day, status, recorded_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '2026-11-01', 'present', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', '2026-11-01', 'absent', '00000000-0000-0000-0000-0000000000b2');
insert into payments (student_id, month, amount, recorded_by) values
  ('00000000-0000-0000-0000-0000000000c1', '2026-11', 300, '00000000-0000-0000-0000-0000000000a1');

-- ---------- one manager only ----------
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test.invalid', 'authenticated', 'authenticated');
do $$
begin
  insert into profiles (id, role, full_name, phone) values ('00000000-0000-0000-0000-0000000000a2', 'admin', 'Second Admin', '01000000009');
  raise exception 'a second manager was made';
exception when unique_violation then null;
end $$;

-- ---------- student one ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
do $$
declare n int;
begin
  assert (select count(*) from grades) = 0, 'student can read grades';
  assert (select count(*) from payments) = 0, 'student can read payments';
  assert (select count(*) from notices) = 0, 'student can read notices';
  assert (select count(*) from profiles) = 1, 'student sees other people';
  assert (select count(*) from submissions) = 1, 'student sees other submissions';
  assert (select count(*) from attendance) = 1, 'student sees other attendance';
  assert (select count(*) from assignments) = 1, 'student sees other groups'' assignments';
  assert (select count(*) from groups) = 1, 'student sees other groups';

  update profiles set role = 'admin' where id = auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'student promoted themself';

  begin
    insert into grades (submission_id, correct, wrong) values ('00000000-0000-0000-0000-0000000000f1', 10, 0);
    raise exception 'student wrote a grade';
  exception when insufficient_privilege then null; end;

  begin
    insert into submissions (assignment_id, photo_path) values ('00000000-0000-0000-0000-0000000000e2', auth.uid()::text || '/x.jpg');
    raise exception 'student sent work to another group''s assignment';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set status = 'reviewed' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'student marked their own work reviewed';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_path = '00000000-0000-0000-0000-0000000000c2/two.jpg' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'student pointed their work at another student''s photo';
  exception when insufficient_privilege then null; end;

  update submissions set photo_path = auth.uid()::text || '/again.jpg' where id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 1, 'student cannot resend work before it is reviewed';

  begin
    insert into storage.objects (bucket_id, name) values ('solutions', '00000000-0000-0000-0000-0000000000c2/x.jpg');
    raise exception 'student uploaded into another student''s folder';
  exception when insufficient_privilege then null; end;
  insert into storage.objects (bucket_id, name) values ('solutions', '00000000-0000-0000-0000-0000000000c1/x.jpg');
end $$;

-- once reviewed, the student cannot replace it
reset role;
update submissions set status = 'reviewed' where id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
do $$
declare n int;
begin
  update submissions set photo_path = auth.uid()::text || '/late.jpg' where id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 0, 'student replaced reviewed work';
  assert (select status from submissions) = 'reviewed', 'student cannot see that work was reviewed';
end $$;

-- ---------- teacher one: grade and attendance allowed, payments not ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
do $$
declare n int;
begin
  assert (select count(*) from profiles) = 2, 'teacher sees people outside their groups';
  assert (select count(*) from groups) = 1, 'teacher sees other groups';
  assert (select count(*) from submissions) = 1, 'teacher sees other groups'' work';
  assert (select count(*) from grades) = 1, 'teacher cannot read their own students'' grades';
  assert (select count(*) from payments) = 0, 'teacher reads payments without permission';
  assert (select count(*) from storage.objects where bucket_id = 'solutions') = 1, 'teacher cannot see their student''s photo';

  update profiles set can_see_payments = true where id = auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed their own permissions';

  update grades set correct = 8, wrong = 2 where submission_id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 1, 'teacher cannot regrade';

  insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '2026-11-02', 'late');
  begin
    insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', '2026-11-02', 'late');
    raise exception 'teacher took attendance for another teacher''s group';
  exception when insufficient_privilege then null; end;

  begin
    insert into grades (submission_id, correct, wrong) values ('00000000-0000-0000-0000-0000000000f2', 10, 0);
    raise exception 'teacher graded another group';
  exception when insufficient_privilege then null; end;

  begin
    insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c2', '2026-11-02', 'absent');
    raise exception 'teacher marked another group''s student under their own group';
  exception when insufficient_privilege then null; end;

  begin
    update grades set graded_by = '00000000-0000-0000-0000-0000000000b2' where submission_id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'teacher graded under another teacher''s name';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set student_id = '00000000-0000-0000-0000-0000000000c2' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'teacher moved a solution to another student';
  exception when raise_exception then null; end;

  delete from assignments where id = '00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  assert n = 0, 'teacher deleted homework (and its grades with it)';
end $$;

-- ---------- teacher two: no permissions ticked ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$
begin
  assert (select count(*) from submissions) = 1, 'teacher two cannot see their own students'' work';
  begin
    insert into grades (submission_id, correct, wrong) values ('00000000-0000-0000-0000-0000000000f2', 10, 0);
    raise exception 'teacher graded without the grading permission';
  exception when insufficient_privilege then null; end;
  begin
    insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', '2026-11-03', 'present');
    raise exception 'teacher took attendance without the attendance permission';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------- admin ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$
begin
  -- only this test's rows, so it also passes on a database that already has data
  assert (select count(*) from profiles where id::text like '00000000-0000-0000-0000-0000000000%') = 5, 'admin does not see everyone';
  assert (select count(*) from grades where submission_id::text like '00000000-0000-0000-0000-0000000000%') = 1, 'admin cannot read grades';
  assert (select count(*) from payments where student_id::text like '00000000-0000-0000-0000-0000000000%') = 1, 'admin cannot read payments';
  insert into notices (body) values ('test');
end $$;

-- ---------- signed out ----------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  assert (select count(*) from profiles) = 0, 'signed-out visitor reads profiles';
  assert (select count(*) from grades) = 0, 'signed-out visitor reads grades';
exception when insufficient_privilege then null;
end $$;

rollback;
\echo 'RLS: all checks passed'
