-- Proves who can see and change what. Runs inside a transaction and rolls back.
-- npm run test:rls   (needs a local database with no manager yet: npm run db:reset)
\set ON_ERROR_STOP 1
begin;

-- People: a1 the manager; b1 teaches group d1 (may grade and take attendance), b2 teaches d2 (nothing ticked),
-- b3 teaches d3 (everything ticked). Students: c1 in d1, c2 in d2, c3 in d1 and d2, c4 in d3, c5 was in d1 and left.
insert into auth.users (id, email, aud, role)
select ('00000000-0000-0000-0000-0000000000' || x)::uuid, x || '@test.invalid', 'authenticated', 'authenticated'
from unnest(array['a1', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3', 'c4', 'c5', 'f0']) x;   -- f0: a login with no profile

insert into profiles (id, role, full_name, phone, can_grade, can_attendance, can_add_students, can_see_payments) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', '01000000001', false, false, false, false),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher', 'Teacher One', '01000000002', true, true, false, false),
  ('00000000-0000-0000-0000-0000000000b2', 'teacher', 'Teacher Two', '01000000003', false, false, false, false),
  ('00000000-0000-0000-0000-0000000000b3', 'teacher', 'Teacher Three', '01000000008', true, true, true, true);
insert into groups (id, name, teacher_id, monthly_fee) values
  ('00000000-0000-0000-0000-0000000000d1', 'Group One', '00000000-0000-0000-0000-0000000000b1', 300),
  ('00000000-0000-0000-0000-0000000000d2', 'Group Two', '00000000-0000-0000-0000-0000000000b2', 250),
  ('00000000-0000-0000-0000-0000000000d3', 'Group Three', '00000000-0000-0000-0000-0000000000b3', 400);
insert into profiles (id, role, full_name, phone) values
  ('00000000-0000-0000-0000-0000000000c1', 'student', 'Student One', '01000000004'),
  ('00000000-0000-0000-0000-0000000000c2', 'student', 'Student Two', '01000000005'),
  ('00000000-0000-0000-0000-0000000000c3', 'student', 'Student Three', '01000000006'),
  ('00000000-0000-0000-0000-0000000000c4', 'student', 'Student Four', '01000000007'),
  ('00000000-0000-0000-0000-0000000000c5', 'student', 'Student Five', '01000000010');
insert into enrollments (student_id, group_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d2'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d2'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000d3'),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000d1');
insert into special_fees (student_id, group_id, monthly_fee) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 200),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000d3', 350);
insert into assignments (id, group_id, title, questions, created_by) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', 'Work One', 10, '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', 'Work Two', 10, '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d3', 'Work Three', 10, '00000000-0000-0000-0000-0000000000b3');
insert into submissions (id, assignment_id, student_id, photo_paths) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', array['00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000e1-one.jpg']),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c2', array['00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-0000000000e2-two.jpg']),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c3', array['00000000-0000-0000-0000-0000000000c3/00000000-0000-0000-0000-0000000000e2-three.jpg']),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c5', array['00000000-0000-0000-0000-0000000000c5/00000000-0000-0000-0000-0000000000e1-five.jpg']);
insert into grades (submission_id, correct, wrong, note, graded_by) values
  ('00000000-0000-0000-0000-0000000000f1', 7, 3, 'check question 4', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000f3', 9, 1, 'for teacher two only', '00000000-0000-0000-0000-0000000000b2');
insert into storage.objects (bucket_id, name) values
  ('solutions', '00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000e1-one.jpg'),
  ('solutions', '00000000-0000-0000-0000-0000000000c3/00000000-0000-0000-0000-0000000000e2-three.jpg');
insert into attendance (group_id, student_id, day, status, recorded_by) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', cairo_today() - 3, 'present', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', cairo_today() - 40, 'absent', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c5', cairo_today() - 3, 'late', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', cairo_today() - 3, 'absent', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', cairo_today() - 5, 'absent', '00000000-0000-0000-0000-0000000000b2');
insert into payments (student_id, group_id, month, amount, recorded_by) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', '2026-11', 200, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d2', '2026-11', 250, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000d3', '2026-11', 350, '00000000-0000-0000-0000-0000000000a1');
insert into notices (group_id, body, created_by) values
  (null, 'for everyone', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d1', 'for group one', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000d2', 'for group two', '00000000-0000-0000-0000-0000000000a1');
-- student five leaves group one; what they did there stays
delete from enrollments where student_id = '00000000-0000-0000-0000-0000000000c5';

-- ---------- rules that hold for everyone, the database owner included ----------
do $$
begin
  begin
    insert into enrollments (student_id, group_id) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1');
    raise exception 'FAIL: a teacher was enrolled as a student';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;

  begin
    insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-0000000000a2', 'a2@test.invalid', 'authenticated', 'authenticated');
    insert into profiles (id, role, full_name, phone) values ('00000000-0000-0000-0000-0000000000a2', 'admin', 'Second Admin', '01000000009');
    raise exception 'FAIL: a second manager was made';
  exception when unique_violation then null; end;

  begin
    update grades set correct = 9, wrong = 9 where submission_id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: a grade counts more answers than the homework has questions';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;

  begin
    update grades set unclear = 6, blank = 5 where submission_id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: unclear and blank answers go past the homework''s questions';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;

  begin
    update assignments set questions = 5 where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FAIL: a homework shrank below a grade already given';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;

  begin
    update assignments set group_id = '00000000-0000-0000-0000-0000000000d2' where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FAIL: a homework moved to another group';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;

  begin
    delete from groups where id = '00000000-0000-0000-0000-0000000000d2';
    raise exception 'FAIL: a group with payments recorded was deleted';
  exception when foreign_key_violation then null; end;

  assert (select count(*) from payments where student_id = '00000000-0000-0000-0000-0000000000c5') = 0
     and (select count(*) from attendance where student_id = '00000000-0000-0000-0000-0000000000c5') = 1
     and (select count(*) from submissions where student_id = '00000000-0000-0000-0000-0000000000c5') = 1, 'leaving a group erased what was recorded there';
  assert schema_version() >= 4, 'schema_version is behind';
end $$;

set local role authenticated;

-- ---------- student one ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
do $$
declare n int;
begin
  assert (select count(*) from grades) = 0, 'student can read grades';
  assert (select count(*) from payments) = 0, 'student can read payments';
  assert (select count(*) from special_fees) = 0, 'student can read special fees';
  assert (select count(*) from notices) = 2, 'student reads notices of other groups, or none of their own';
  assert (select count(*) from profiles) = 1, 'student sees other people';
  assert (select count(*) from enrollments) = 1, 'student sees who else is in the group';
  assert (select count(*) from submissions) = 1, 'student sees other submissions';
  assert (select count(*) from attendance) = 2, 'student does not see exactly their own attendance';
  assert (select count(*) from assignments) = 1, 'student sees other groups'' assignments';
  assert (select count(*) from groups) = 1, 'student sees other groups';
  assert (select count(*) from storage.objects where bucket_id = 'solutions') = 1, 'student does not see exactly their own photos';
  -- their own totals are theirs to see; grades stay out of them
  assert (select classes = 2 and present = 1 and absent = 1 and graded = 0 and average is null from student_stats) is true, 'student totals are wrong, or carry grades';

  update profiles set role = 'admin' where id = auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'student promoted themself';

  begin
    insert into grades (submission_id, correct, wrong) values ('00000000-0000-0000-0000-0000000000f1', 10, 0);
    raise exception 'FAIL: student wrote a grade';
  exception when insufficient_privilege then null; end;

  if grade_submission('00000000-0000-0000-0000-0000000000f1', 10, 0, '', (select created_at from submissions)) = 'ok' then
    raise exception 'FAIL: student graded their own work';
  end if;

  begin
    insert into submissions (assignment_id, photo_paths) values ('00000000-0000-0000-0000-0000000000e2', array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e2-x.jpg']);
    raise exception 'FAIL: student sent work to another group''s assignment';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set status = 'reviewed' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: student marked their own work reviewed';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_paths = array['00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-0000000000e2-two.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: student pointed their work at another student''s photo';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_paths = array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-ok.jpg', '00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-0000000000e2-two.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: student slipped another student''s photo in as a second page';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_paths = array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e2-x.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: student pointed their work at a photo of a different homework';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set photo_paths = '{}' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: student sent a solution with no pages';
  exception when check_violation then null; end;

  begin
    update submissions set photo_paths = (select array_agg(auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-' || i || '.jpg') from generate_series(1, 11) i)
      where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: student sent more than 10 pages';
  exception when check_violation then null; end;

  begin
    update submissions set assignment_id = '00000000-0000-0000-0000-0000000000e2' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: student moved their work to another homework';
  exception when raise_exception or insufficient_privilege then if sqlerrm like 'FAIL:%' then raise; end if; end;

  -- several pages, and sending again before it is reviewed; the time is the database's, not the sender's
  update submissions set photo_paths = array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-again-1.jpg', auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-again-2.jpg'],
      created_at = '2020-01-01'
    where id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 1, 'student cannot resend work before it is reviewed';
  assert (select cardinality(photo_paths) from submissions) = 2, 'the second page was not kept';
  assert (select created_at > now() - interval '1 minute' from submissions), 'student backdated their work';

  delete from submissions where id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 0, 'student deleted a sent solution';

  begin
    insert into enrollments (student_id, group_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000d2');
    raise exception 'FAIL: student put themself in another group';
  exception when insufficient_privilege then null; end;

  begin
    insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d1', auth.uid(), cairo_today(), 'present');
    raise exception 'FAIL: student marked themself present';
  exception when insufficient_privilege then null; end;
  update attendance set status = 'present' where student_id = auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'student changed their attendance';

  begin
    insert into payments (student_id, group_id, month, amount) values (auth.uid(), '00000000-0000-0000-0000-0000000000d1', '2026-12', 0);
    raise exception 'FAIL: student recorded a payment';
  exception when insufficient_privilege then null; end;
  begin
    insert into notices (body) values ('free day');
    raise exception 'FAIL: student wrote a notice';
  exception when insufficient_privilege then null; end;
  begin
    insert into assignments (group_id, title, questions) values ('00000000-0000-0000-0000-0000000000d1', 'Mine', 1);
    raise exception 'FAIL: student set homework';
  exception when insufficient_privilege then null; end;

  -- photos: only into their own folder, only for homework of a group they are in, one folder deep
  begin
    insert into storage.objects (bucket_id, name) values ('solutions', '00000000-0000-0000-0000-0000000000c2/00000000-0000-0000-0000-0000000000e1-x.jpg');
    raise exception 'FAIL: student uploaded into another student''s folder';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('solutions', auth.uid()::text || '/anything.jpg');
    raise exception 'FAIL: student stored a file that belongs to no homework';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('solutions', auth.uid()::text || '/00000000-0000-0000-0000-0000000000e2-x.jpg');
    raise exception 'FAIL: student stored a photo for another group''s homework';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('solutions', auth.uid()::text || '/deep/00000000-0000-0000-0000-0000000000e1-x.jpg');
    raise exception 'FAIL: student stored a photo in a sub-folder';
  exception when insufficient_privilege then null; end;
  insert into storage.objects (bucket_id, name) values ('solutions', auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-x.jpg');
  update storage.objects set name = auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-moved.jpg' where name like '%e1-x.jpg';
  get diagnostics n = row_count;
  assert n = 0, 'student renamed a stored photo';
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

-- ---------- student five: left their group ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
do $$
declare n int;
begin
  -- what they did there still has a group and a homework to its name
  assert (select count(*) from attendance) = 1 and (select count(*) from groups) = 1, 'a student who left cannot read their old attendance with its group';
  assert (select count(*) from submissions) = 1 and (select count(*) from assignments) = 1, 'a student who left cannot read what they sent, with its homework';
  assert (select count(*) from notices) = 1, 'a student who left still reads the group''s notices';
  begin
    update submissions set photo_paths = array[auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-new.jpg'];
    raise exception 'FAIL: a student who left the group sent work again';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('solutions', auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-new.jpg');
    raise exception 'FAIL: a student who left the group stored a photo';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------- teacher one: grade and attendance allowed; adding students and payments not ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
do $$
declare n int; seen timestamptz;
begin
  -- c1 and c3 are in the group; c5 left but their work and attendance here still carry a name
  assert (select count(*) from profiles) = 4, 'teacher sees people outside their groups, or loses a former student''s name';
  assert (select count(*) from groups) = 1, 'teacher sees other groups';
  assert (select count(*) from enrollments) = 2, 'teacher sees who is in other teachers'' groups';
  -- student three also sends work to teacher two: none of that is teacher one's to see
  assert (select count(*) from submissions) = 3, 'teacher sees work sent to another teacher';
  assert (select count(*) from grades) = 1, 'teacher reads grades another teacher gave';
  assert (select count(*) from payments) = 0, 'teacher reads payments without permission';
  assert (select count(*) from special_fees) = 0, 'teacher reads special fees without permission';
  assert (select count(*) from storage.objects where bucket_id = 'solutions' and name like '%one.jpg') = 1, 'teacher cannot see their student''s photo';
  assert (select count(*) from storage.objects where bucket_id = 'solutions' and name like '%three.jpg') = 0, 'teacher sees a photo sent to another teacher';
  assert (select count(*) from notices) = 2, 'teacher reads another group''s notices';
  assert (select count(*) from student_stats) = 2 and (select average from student_stats where student_id = '00000000-0000-0000-0000-0000000000c1') = 70, 'teacher''s group totals are wrong';
  assert (select sent from homework_counts) = 2, 'homework count is wrong, or counts a student who left';

  update profiles set can_see_payments = true where id = auth.uid();
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed their own permissions';
  update profiles set full_name = 'Renamed' where id = '00000000-0000-0000-0000-0000000000c1';
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed a student''s profile';

  update grades set correct = 8, wrong = 2 where submission_id = '00000000-0000-0000-0000-0000000000f1';
  get diagnostics n = row_count;
  assert n = 1, 'teacher cannot regrade';

  -- grading in one step, and only what was on the screen
  select created_at into seen from submissions where student_id = '00000000-0000-0000-0000-0000000000c3';
  assert grade_submission((select id from submissions where student_id = '00000000-0000-0000-0000-0000000000c3'), 6, 9, '', seen) = 'range', 'grading accepted more answers than questions';
  assert grade_submission((select id from submissions where student_id = '00000000-0000-0000-0000-0000000000c3'), 6, 2, 'ok', seen - interval '1 second') = 'changed', 'grading went onto pages the teacher had not seen';
  assert grade_submission((select id from submissions where student_id = '00000000-0000-0000-0000-0000000000c3'), 6, 2, '', seen, 2, 1) = 'range', 'grading accepted more answers than questions, counting unclear and blank';
  assert grade_submission((select id from submissions where student_id = '00000000-0000-0000-0000-0000000000c3'), 6, 1, '', seen, -1, 0) = 'range', 'grading accepted a negative unclear count';
  assert grade_submission((select id from submissions where student_id = '00000000-0000-0000-0000-0000000000c3'), 6, 2, 'ok', seen) = 'ok', 'teacher cannot grade in one step';
  assert (select (unclear, blank) = (0, 0) from grades g join submissions s on s.id = g.submission_id where s.student_id = '00000000-0000-0000-0000-0000000000c3'), 'right and wrong alone did not leave unclear and blank at 0';
  assert grade_submission((select id from submissions where student_id = '00000000-0000-0000-0000-0000000000c3'), 6, 1, 'ok', seen, 2, 1) = 'ok', 'teacher cannot grade with unclear and blank answers';
  assert (select (correct, wrong, unclear, blank) = (6, 1, 2, 1) from grades g join submissions s on s.id = g.submission_id where s.student_id = '00000000-0000-0000-0000-0000000000c3'), 'unclear and blank were not kept';
  assert (select status from submissions where student_id = '00000000-0000-0000-0000-0000000000c3') = 'reviewed', 'grading did not mark the solution reviewed';
  assert grade_submission('00000000-0000-0000-0000-0000000000f3', 1, 9, '', now()) = 'missing', 'teacher reached work a shared student sent to another teacher';
  update grades set correct = 1 where submission_id = '00000000-0000-0000-0000-0000000000f3';
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed another teacher''s grade';
  update submissions set status = 'reviewed' where id = '00000000-0000-0000-0000-0000000000f3';
  get diagnostics n = row_count;
  assert n = 0, 'teacher marked another teacher''s work reviewed';

  insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', cairo_today(), 'late');
  begin
    insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', cairo_today(), 'late');
    raise exception 'FAIL: teacher took attendance for another teacher''s group';
  exception when insufficient_privilege then null; end;
  begin
    insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c2', cairo_today(), 'absent');
    raise exception 'FAIL: teacher marked another group''s student under their own group';
  exception when insufficient_privilege then null; end;
  begin
    insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', cairo_today() + 1, 'present');
    raise exception 'FAIL: teacher took attendance for tomorrow';
  exception when insufficient_privilege then null; end;

  begin
    update grades set graded_by = '00000000-0000-0000-0000-0000000000b2' where submission_id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: teacher graded under another teacher''s name';
  exception when insufficient_privilege then null; end;

  begin
    update submissions set student_id = '00000000-0000-0000-0000-0000000000c2' where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: teacher moved a solution to another student';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin
    update submissions set photo_paths = array['00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000e1-swapped.jpg'] where id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FAIL: teacher changed the pages of a student''s solution';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;

  begin
    insert into enrollments (student_id, group_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1');
    raise exception 'FAIL: teacher put a student in a group straight in the database';
  exception when insufficient_privilege then null; end;
  delete from enrollments where student_id = '00000000-0000-0000-0000-0000000000c1';
  get diagnostics n = row_count;
  assert n = 0, 'teacher removed a student from a group';

  update assignments set title = 'Work One, fixed' where id = '00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  assert n = 1, 'teacher cannot fix their own homework''s title';
  update assignments set title = 'Not mine' where id = '00000000-0000-0000-0000-0000000000e2';
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed another teacher''s homework';
  begin
    update assignments set created_by = '00000000-0000-0000-0000-0000000000c1' where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'FAIL: teacher put a homework under someone else''s name';
  exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
  begin
    insert into assignments (group_id, title, questions, created_by) values ('00000000-0000-0000-0000-0000000000d1', 'Forged', 5, '00000000-0000-0000-0000-0000000000b2');
    raise exception 'FAIL: teacher set homework under another teacher''s name';
  exception when insufficient_privilege then null; end;
  delete from assignments where id = '00000000-0000-0000-0000-0000000000e1';
  get diagnostics n = row_count;
  assert n = 0, 'teacher deleted homework (and its grades with it)';

  -- a class on the wrong day can be taken back, but not the group's old history
  delete from attendance where group_id = '00000000-0000-0000-0000-0000000000d1' and day = cairo_today();
  get diagnostics n = row_count;
  assert n = 1, 'teacher cannot take back a class written on the wrong day';
  delete from attendance where group_id = '00000000-0000-0000-0000-0000000000d1' and day = cairo_today() - 40;
  get diagnostics n = row_count;
  assert n = 0, 'teacher deleted attendance from more than two weeks ago';
  delete from attendance where group_id = '00000000-0000-0000-0000-0000000000d2';
  get diagnostics n = row_count;
  assert n = 0, 'teacher deleted another group''s attendance';

  begin
    insert into groups (name, teacher_id) values ('Mine', auth.uid());
    raise exception 'FAIL: teacher made a group';
  exception when insufficient_privilege then null; end;
  update groups set monthly_fee = 1 where id = '00000000-0000-0000-0000-0000000000d1';
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed a group''s fee';
  begin
    insert into payments (student_id, group_id, month, amount) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', '2026-12', 0);
    raise exception 'FAIL: teacher recorded a payment';
  exception when insufficient_privilege then null; end;
  begin
    insert into notices (group_id, body) values ('00000000-0000-0000-0000-0000000000d1', 'no class');
    raise exception 'FAIL: teacher wrote a notice';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('solutions', '00000000-0000-0000-0000-0000000000c1/00000000-0000-0000-0000-0000000000e1-t.jpg');
    raise exception 'FAIL: teacher stored a photo in a student''s folder';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------- teacher two: no permissions ticked ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$
declare n int;
begin
  assert (select count(*) from submissions) = 2, 'teacher two cannot see their own students'' work';
  assert (select count(*) from payments) = 0, 'teacher reads payments without permission';
  assert (select count(*) from storage.objects where bucket_id = 'solutions' and name like '%three.jpg') = 1, 'teacher two cannot open a photo sent to them';
  assert (select count(*) from absent_twice) = 1, 'two absences in a row are not flagged';
  begin
    insert into grades (submission_id, correct, wrong) values ('00000000-0000-0000-0000-0000000000f2', 10, 0);
    raise exception 'FAIL: teacher graded without the grading permission';
  exception when insufficient_privilege then null; end;
  update grades set correct = 1 where submission_id = '00000000-0000-0000-0000-0000000000f3';
  get diagnostics n = row_count;
  assert n = 0, 'teacher regraded without the grading permission';
  assert grade_submission('00000000-0000-0000-0000-0000000000f2', 5, 5, '', (select created_at from submissions where id = '00000000-0000-0000-0000-0000000000f2')) = 'missing', 'teacher graded in one step without the grading permission';
  update submissions set status = 'reviewed' where id = '00000000-0000-0000-0000-0000000000f2';
  get diagnostics n = row_count;
  assert n = 0, 'teacher marked work reviewed without the grading permission';
  begin
    insert into attendance (group_id, student_id, day, status) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', cairo_today(), 'present');
    raise exception 'FAIL: teacher took attendance without the attendance permission';
  exception when insufficient_privilege then null; end;
  update attendance set status = 'present' where group_id = '00000000-0000-0000-0000-0000000000d2';
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed attendance without the attendance permission';
  delete from attendance where group_id = '00000000-0000-0000-0000-0000000000d2';
  get diagnostics n = row_count;
  assert n = 0, 'teacher deleted attendance without the attendance permission';
end $$;

-- ---------- teacher three: every permission ticked, still only their own group ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
do $$
declare n int;
begin
  assert (select count(*) from payments) = 1, 'teacher with the payments permission does not see exactly their own group''s payments';
  assert (select count(*) from special_fees) = 1, 'teacher with the payments permission does not see exactly their own group''s special fees';
  assert (select count(*) from profiles) = 2, 'teacher three sees people outside their group';
  begin
    insert into payments (student_id, group_id, month, amount) values ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000d3', '2026-12', 400);
    raise exception 'FAIL: teacher recorded a payment';
  exception when insufficient_privilege then null; end;
  delete from payments where student_id = '00000000-0000-0000-0000-0000000000c4';
  get diagnostics n = row_count;
  assert n = 0, 'teacher took back a payment';
  update special_fees set monthly_fee = 0;
  get diagnostics n = row_count;
  assert n = 0, 'teacher changed a special fee';
  -- adding students goes through the server, which checks the permission and the group; not straight into the table
  begin
    insert into enrollments (student_id, group_id) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d3');
    raise exception 'FAIL: teacher pulled another teacher''s student into their group straight in the database';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------- admin ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$
declare n int;
begin
  -- only this test's rows, so it also passes on a database that already has data
  assert (select count(*) from profiles where id::text like '00000000-0000-0000-0000-0000000000%') = 9, 'admin does not see everyone';
  assert (select count(*) from grades where submission_id::text like '00000000-0000-0000-0000-0000000000%') = 2, 'admin cannot read grades';
  assert (select count(*) from payments where student_id::text like '00000000-0000-0000-0000-0000000000%') = 3, 'admin cannot read payments';
  insert into notices (body) values ('test');
  update special_fees set monthly_fee = 150 where student_id = '00000000-0000-0000-0000-0000000000c1';
  update groups set monthly_fee = 320, archived_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
  insert into enrollments (student_id, group_id) values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d3');
  delete from enrollments where student_id = '00000000-0000-0000-0000-0000000000c3' and group_id = '00000000-0000-0000-0000-0000000000d2';
  -- leaving a group keeps what was recorded there
  assert (select count(*) from payments where student_id = '00000000-0000-0000-0000-0000000000c3') = 1, 'leaving a group erased its payments';
  delete from attendance where group_id = '00000000-0000-0000-0000-0000000000d1' and day = cairo_today() - 40;
  get diagnostics n = row_count;
  assert n = 1, 'the manager cannot take back an old class';
end $$;

-- an archived group takes no more work
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
do $$
begin
  begin
    insert into storage.objects (bucket_id, name) values ('solutions', auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-late.jpg');
    raise exception 'FAIL: a photo was stored for an archived group''s homework';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------- a login with no profile (sign-ups left open by mistake) ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f0","role":"authenticated"}';
do $$
begin
  assert (select count(*) from notices) = 0 and (select count(*) from profiles) = 0 and (select count(*) from groups) = 0
     and (select count(*) from assignments) = 0 and (select count(*) from enrollments) = 0, 'a login with no profile reads something';
  begin
    insert into storage.objects (bucket_id, name) values ('solutions', auth.uid()::text || '/00000000-0000-0000-0000-0000000000e1-x.jpg');
    raise exception 'FAIL: a login with no profile stored a file';
  exception when insufficient_privilege then null; end;
  begin
    perform drop_orphan_login('c1@test.invalid');
    raise exception 'FAIL: a signed-in user ran a server-only function';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------- signed out ----------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
declare t text; n int;
begin
  foreach t in array array['profiles', 'groups', 'assignments', 'attendance', 'enrollments', 'special_fees', 'submissions', 'grades', 'payments', 'notices', 'student_stats'] loop
    begin
      execute format('select count(*) from %I', t) into n;
      assert n = 0, 'signed-out visitor reads ' || t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    perform is_admin();
    raise exception 'FAIL: signed-out visitor ran a helper function';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
\echo 'RLS: all checks passed'
