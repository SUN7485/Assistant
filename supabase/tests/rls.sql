-- Proves who can see and change what. Runs inside a transaction and rolls back.
-- npm run test:rls   (needs `npx supabase start`)
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 't1@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 't2@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 's1@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 's2@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 's3@test.invalid', 'authenticated', 'authenticated');

insert into profiles (id, role, full_name, phone, can_grade, can_attendance, can_see_payments) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', '01000000001', false, false, false),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher', 'Teacher One', '01000000002', true, true, false),
  ('00000000-0000-0000-0000-0000000000b2', 'teacher', 'Teacher Two', '01000000003', false, false, false);
insert into groups (id, name, teacher_id) values
  ('00000000-0000-0000-0000-0000000000d1', 'Group One', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d2', 'Group Two', '00000000-0000-0000-0000-0000000000b2');
-- student three is in both groups: each teacher must see only their own side of them
insert into profiles (id, role, full_name, phone) values
  ('00000000-0000-0000-0000-0000000000c1', 'student', 'Student One', '01000000004'),
  ('00000000-0000-0000-0000-0000000000c2', 'student', 'Student Two', '01000000005'),
  ('00000000-0000-0000-0000-0000000000c3', 'student', 'Student Three', '01000000006');
insert into enrollments (student_id, group_id, monthly_fee) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 300),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d2', 250),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d1', 300),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d2', 250);
insert into assignments (id, group_id, title, questions, created_by) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Work One', 10, '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 'Work Two', 10, '00000000-0000-0000-0000-0000000000b2');
insert into submissions (id, assignment_id, student_id, photo_paths) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', array['00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000e1-one.jpg']),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c2', array['00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-0000000000e2-two.jpg']),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c3', array['00000000-0000-0000-0000-0000000000c3/00000000-0000-0000-0000-0000000000e2-three.jpg']);
insert into grades (submission_id, correct, wrong, note, graded_by) values
  ('00000000-0000-0000-0000-0000000000f1', 7, 3, 'check question 4', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000f3', 9, 1, 'for teacher two only', '00000000-0000-0000-0000-0000000000b2');
insert into storage.objects (bucket_id, name) values
  ('solutions', '00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000e1-one.jpg'),
  ('solutions', '00000000-0000-0000-0000-0000000000c3/00000000-0000-0000-0000-0000000000e2-three.jpg');
insert into attendance (group_id, student_id, day, status, recorded_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '2026-11-01', 'present', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', '2026-11-01', 'absent', '00000000-0000-0000-0000-0000000000b2');
insert into payments (student_id, group_id, month, amount, recorded_by) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', '2026-11', 300, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d2', '2026-11', 250, '00000000-0000-0000-0000-0000000000a1');
insert into notices (group_id, body, created_by) values
  (null, 'for everyone', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d1', 'for group one', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', 'for group two', '00000000-0000-0000-0000-0000000000a1');

do $$
begin
  insert into enrollments (student_id, group_id) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1');
  raise exception 'a teacher was enrolled as a student';
exception when raise_exception then
  if sqlerrm <> 'only a student can be put in a group' then raise; end if;
end $$;

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
  assert (select count(*) from notices) = 2, 'student reads notices of other groups, or none of their own';
  assert (select count(*) from enrollments) = 1, 'student sees who else is in the group';
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
    insert into submissions (assignment_id, photo_paths) values ('00000000-0000-0000-0000-0000000000e2', array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e2-x.jpg']);
    raise exception 'student sent work to another group''s assignment';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set status = 'reviewed' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'student marked their own work reviewed';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_paths = array['00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-0000000000e2-two.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'student pointed their work at another student''s photo';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_paths = array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-ok.jpg', '00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-0000000000e2-two.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'student slipped another student''s photo in as a second page';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_paths = array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e2-x.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'student pointed their work at a photo of a different homework';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_paths = '{}' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'student sent a solution with no pages';
  exception when check_violation then null; end;

  begin
    update submissions set photo_paths = (select array_agg(auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-' || i || '.jpg') from generate_series(1, 11) i)
      where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'student sent more than 10 pages';
  exception when check_violation then null; end;

  -- several pages, and sending again before it is reviewed
  update submissions set photo_paths = array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-again-1.jpg', auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-again-2.jpg']
    where id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 1, 'student cannot resend work before it is reviewed';
  assert (select cardinality(photo_paths) from submissions) = 2, 'the second page was not kept';

  begin
    insert into enrollments (student_id, group_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000d2');
    raise exception 'student put themself in another group';
  exception when insufficient_privilege then null; end;

  update enrollments set monthly_fee = 0 where student_id = auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'student changed their own fee';

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
  update submissions set photo_paths = array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-late.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 0, 'student replaced reviewed work';
  assert (select status from submissions) = 'reviewed', 'student cannot see that work was reviewed';
end $$;

-- ---------- student three: in both groups ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
do $$
begin
  assert (select count(*) from groups) = 2, 'a student in two groups does not see both';
  assert (select count(*) from assignments) = 2, 'a student in two groups does not see both groups'' homework';
  assert (select count(*) from notices) = 3, 'a student in two groups does not see both groups'' notices';
  insert into submissions (assignment_id, photo_paths) values ('00000000-0000-0000-0000-0000000000e1', array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-a.jpg']);
end $$;

-- ---------- teacher one: grade and attendance allowed, payments not ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
do $$
declare n int;
begin
  assert (select count(*) from profiles) = 3, 'teacher sees people outside their groups';
  assert (select count(*) from groups) = 1, 'teacher sees other groups';
  assert (select count(*) from enrollments) = 2, 'teacher sees who is in other teachers'' groups';
  -- student three also sends work to teacher two: none of that is teacher one's to see
  assert (select count(*) from submissions) = 2, 'teacher sees work sent to another teacher';
  assert (select count(*) from grades) = 1, 'teacher reads grades another teacher gave';
  assert (select count(*) from payments) = 0, 'teacher reads payments without permission';
  assert (select count(*) from storage.objects where bucket_id = 'solutions' and name like '%one.jpg') = 1, 'teacher cannot see their student''s photo';
  assert (select count(*) from storage.objects where bucket_id = 'solutions' and name like '%three.jpg') = 0, 'teacher sees a photo sent to another teacher';
  assert (select count(*) from notices) = 2, 'teacher reads another group''s notices';

  begin
    insert into grades (submission_id, correct, wrong) values ('00000000-0000-0000-0000-0000000000f3', 1, 9);
    raise exception 'teacher graded work a shared student sent to another teacher';
  exception when insufficient_privilege or unique_violation then
    if sqlstate = '23505' then raise exception 'teacher reached another teacher''s grade'; end if;
  end;

  begin
    insert into enrollments (student_id, group_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1');
    raise exception 'teacher added a student without the permission';
  exception when insufficient_privilege then null; end;

  update assignments set title = 'Work One, fixed' where id = '00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  assert n = 1, 'teacher cannot fix their own homework''s title';
  update assignments set title = 'Not mine' where id = '00000000-0000-0000-0000-0000000000e2';
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed another teacher''s homework';

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

  begin
    update submissions set photo_paths = array['00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000e1-swapped.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'teacher changed the pages of a student''s solution';
  exception when raise_exception then null; end;

  delete from assignments where id = '00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  assert n = 0, 'teacher deleted homework (and its grades with it)';

  delete from enrollments where student_id = '00000000-0000-0000-0000-0000000000c1';
  get diagnostics n = row_count;
  assert n = 0, 'teacher removed a student from a group';

  delete from attendance where group_id = '00000000-0000-0000-0000-0000000000d1' and day = '2026-11-02';
  get diagnostics n = row_count;
  assert n = 1, 'teacher cannot take back a class written on the wrong day';
  delete from attendance where group_id = '00000000-0000-0000-0000-0000000000d2';
  get diagnostics n = row_count;
  assert n = 0, 'teacher deleted another group''s attendance';
end $$;

-- ---------- teacher two: no permissions ticked ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$
begin
  assert (select count(*) from submissions) = 2, 'teacher two cannot see their own students'' work';
  assert (select count(*) from payments) = 0, 'teacher reads payments without permission';
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
  assert (select count(*) from profiles where id::text like '00000000-0000-0000-0000-0000000000%') = 6, 'admin does not see everyone';
  assert (select count(*) from grades where submission_id::text like '00000000-0000-0000-0000-0000000000%') = 2, 'admin cannot read grades';
  assert (select count(*) from payments where student_id::text like '00000000-0000-0000-0000-0000000000%') = 2, 'admin cannot read payments';
  update enrollments set monthly_fee = 350 where student_id = '00000000-0000-0000-0000-0000000000c1';
  delete from enrollments where student_id = '00000000-0000-0000-0000-0000000000c3' and group_id = '00000000-0000-0000-0000-0000000000d2';
  -- leaving a group keeps what was recorded there
  assert (select count(*) from payments where student_id = '00000000-0000-0000-0000-0000000000c3') = 1, 'leaving a group erased its payments';
  begin
    delete from groups where id = '00000000-0000-0000-0000-0000000000d2';
    raise exception 'a group with payments recorded was deleted';
  exception when foreign_key_violation then null; end;
  assert schema_version() >= 4, 'schema_version is behind';
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
