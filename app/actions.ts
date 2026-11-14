'use server'

import { redirect } from 'next/navigation'
import { can, getMe, type Me } from '@/lib/me'
import { adminDb, db } from '@/lib/supabase'
import { PHONE, back, int, isDay, isMonth, loginEmail, str, today } from '@/lib/util'

// Every action checks who is calling. The database checks again (row-level security),
// except where adminDb() is used, which is why those actions check the role first.

async function staffOnly(test: (me: Me) => boolean, path: string) {
  const r = await getMe()
  if (!test(r.me)) back(path, 'مش مسموح لك تعمل ده', true)
  return r
}

/** Makes a login and its profile together; undoes the login if the profile is refused. */
async function createAccount(phone: string, password: string, profile: Record<string, unknown>) {
  if (!PHONE.test(phone)) return 'رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01'
  if (password.length < 6) return 'كلمة السر لازم تكون 6 حروف أو أرقام على الأقل'
  const admin = adminDb()
  const { data, error } = await admin.auth.admin.createUser({ email: loginEmail(phone), password, email_confirm: true })
  if (error) return error.code === 'email_exists' ? 'الرقم ده عنده حساب قبل كده' : 'الحساب متعملش: ' + error.message
  const { error: e2 } = await admin.from('profiles').insert({ id: data.user.id, phone, ...profile })
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id)
    return 'البيانات مش مظبوطة: ' + e2.message
  }
  return null
}

// ---------- signing in ----------

export async function login(fd: FormData) {
  const phone = str(fd, 'phone')
  if (!PHONE.test(phone)) back('/login', 'رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01', true)
  const sb = await db()
  const { error } = await sb.auth.signInWithPassword({ email: loginEmail(phone), password: String(fd.get('password') ?? '') })
  if (error?.status === 429) back('/login', 'ناس كتير بتدخل دلوقتي. استنى دقيقة وجرّب تاني', true)
  if (error) back('/login', 'الرقم أو كلمة السر غلط', true)
  redirect('/')
}

export async function logout() {
  const sb = await db()
  await sb.auth.signOut()
  redirect('/login')
}

/** First run only: makes the manager's account while there is no manager yet. */
export async function setup(fd: FormData) {
  const admin = adminDb()
  const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
  if (error || count) redirect('/login')
  const phone = str(fd, 'phone'), password = String(fd.get('password') ?? '')
  if (password.length < 8) back('/setup', 'كلمة سر المدير لازم تكون 8 حروف أو أرقام على الأقل', true)
  const err = await createAccount(phone, password, { role: 'admin', full_name: str(fd, 'name') })
  if (err) back('/setup', err, true)
  const sb = await db()
  await sb.auth.signInWithPassword({ email: loginEmail(phone), password })
  back('/home', 'أهلاً! ابدأ بإضافة المدرسين')
}

// ---------- people ----------

export async function addTeacher(fd: FormData) {
  await staffOnly((me) => me.role === 'admin', '/teachers')
  const err = await createAccount(str(fd, 'phone'), String(fd.get('password') ?? ''), {
    role: 'teacher',
    full_name: str(fd, 'name'),
    subject: str(fd, 'subject'),
  })
  if (err) back('/teachers', err, true)
  back('/teachers', 'اتضاف المدرس. ادّيله رقمه وكلمة السر، وعلّم على صلاحياته')
}

export async function savePermissions(fd: FormData) {
  const { sb } = await staffOnly((me) => me.role === 'admin', '/teachers')
  const { error } = await sb
    .from('profiles')
    .update({
      can_attendance: fd.has('attendance'),
      can_grade: fd.has('grade'),
      can_add_students: fd.has('add_students'),
      can_see_payments: fd.has('see_payments'),
    })
    .eq('id', str(fd, 'id'))
    .eq('role', 'teacher')
  if (error) back('/teachers', 'الصلاحيات متحفظتش: ' + error.message, true)
  back('/teachers', 'اتحفظت الصلاحيات')
}

export async function resetPassword(fd: FormData) {
  const path = str(fd, 'back') || '/home'
  await staffOnly((me) => me.role === 'admin', path)
  const password = String(fd.get('password') ?? '')
  if (password.length < 6) back(path, 'كلمة السر لازم تكون 6 حروف أو أرقام على الأقل', true)
  const { error } = await adminDb().auth.admin.updateUserById(str(fd, 'id'), { password })
  if (error) back(path, 'كلمة السر متغيرتش: ' + error.message, true)
  back(path, 'اتغيرت كلمة السر. ابعتها لصاحب الحساب')
}

export async function addGroup(fd: FormData) {
  const { sb } = await staffOnly((me) => me.role === 'admin', '/groups')
  const { data, error } = await sb
    .from('groups')
    .insert({ name: str(fd, 'name'), teacher_id: str(fd, 'teacher'), schedule: str(fd, 'schedule') })
    .select('id')
    .single()
  if (error) back('/groups', 'المجموعة متضافتش: ' + error.message, true)
  back(`/groups?g=${data.id}`, 'اتضافت المجموعة')
}

export async function addStudent(fd: FormData) {
  const gid = str(fd, 'group')
  const path = `/groups?g=${gid}`
  const { sb } = await staffOnly((me) => can(me, 'add_students'), path)
  // A teacher only sees their own groups, so this also checks the group is theirs.
  const { data: g } = await sb.from('groups').select('id').eq('id', gid).maybeSingle()
  if (!g) back(path, 'مش مسموح لك تضيف طلاب في المجموعة دي', true)
  const parent = str(fd, 'parent')
  if (parent && !PHONE.test(parent)) back(path, 'رقم ولي الأمر لازم يكون 11 رقم ويبدأ بـ 01', true)
  const fee = int(fd, 'fee')
  const err = await createAccount(str(fd, 'phone'), String(fd.get('password') ?? ''), {
    role: 'student',
    full_name: str(fd, 'name'),
    group_id: gid,
    parent_phone: parent || null,
    monthly_fee: fee >= 0 ? fee : 0,
  })
  if (err) back(path, err, true)
  back(path, 'اتضاف الطالب. ادّيله رقمه وكلمة السر')
}

export async function addAssignment(fd: FormData) {
  const gid = str(fd, 'group')
  const path = `/groups?g=${gid}`
  const { sb } = await staffOnly((me) => me.role !== 'student', path)
  const questions = int(fd, 'questions')
  if (!(questions >= 1 && questions <= 200)) back(path, 'عدد الأسئلة من 1 لـ 200', true)
  const { error } = await sb.from('assignments').insert({ group_id: gid, title: str(fd, 'title'), questions })
  if (error) back(path, 'الواجب متضافش: ' + error.message, true)
  back(path, 'اتضاف الواجب، والطلاب يقدروا يرفعوا حله دلوقتي')
}

// ---------- attendance ----------

export async function saveAttendance(fd: FormData) {
  const gid = str(fd, 'group'), day = str(fd, 'day')
  const path = `/attendance?g=${gid}&d=${day}`
  const { sb, me } = await staffOnly((me) => can(me, 'attendance'), path)
  if (!isDay(day) || day > today()) back(path, 'اختار يوم صحيح ومش في المستقبل', true)
  const rows = [...fd.entries()]
    .filter(([k, v]) => k.startsWith('s_') && ['present', 'late', 'absent'].includes(String(v)))
    .map(([k, v]) => ({ group_id: gid, student_id: k.slice(2), day, status: String(v), recorded_by: me.id }))
  if (!rows.length) back(path, 'مفيش طلاب في المجموعة دي', true)
  const { error } = await sb.from('attendance').upsert(rows, { onConflict: 'group_id,student_id,day' })
  if (error) back(path, 'الحضور متحفظش: ' + error.message, true)
  const absent = rows.filter((r) => r.status === 'absent').length
  back(path, absent ? `اتحفظ الحضور — ${absent} غايب` : 'اتحفظ الحضور — الكل حضر')
}

// ---------- grading ----------

export async function grade(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/grading/${id}`
  const { sb, me } = await staffOnly((me) => can(me, 'grade'), path)
  const { data: sub } = await sb.from('submissions').select('id, assignment:assignments(questions)').eq('id', id).maybeSingle()
  if (!sub) back('/grading', 'الحل ده مش موجود أو مش من طلابك', true)
  const q = (sub.assignment as unknown as { questions: number }).questions
  const correct = int(fd, 'correct'), wrong = int(fd, 'wrong')
  if (!(correct >= 0 && wrong >= 0)) back(path, 'اكتب عدد الصح والغلط بأرقام', true)
  if (correct + wrong > q) back(path, `الصح والغلط مع بعض أكتر من ${q} سؤال`, true)
  const note = str(fd, 'note').slice(0, 2000)
  const { error } = await sb
    .from('grades')
    .upsert({ submission_id: id, correct, wrong, note, graded_by: me.id, graded_at: new Date().toISOString() })
  if (error) back(path, 'الدرجة مترصدتش: ' + error.message, true)
  await sb.from('submissions').update({ status: 'reviewed' }).eq('id', id)
  const { data: next } = await sb
    .from('submissions')
    .select('id')
    .eq('status', 'new')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  const done = `اترصدت: ${correct} من ${correct + wrong}`
  if (next) back(`/grading/${next.id}`, done + ' — ده الحل اللي بعده')
  back('/grading', done + ' — خلصت كل الحلول')
}

// ---------- money and messages ----------

export async function togglePayment(fd: FormData) {
  const month = str(fd, 'month')
  const path = `/payments?m=${month}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  if (!isMonth(month)) back('/payments', 'الشهر مش صحيح', true)
  const sid = str(fd, 'id')
  if (fd.get('paid') === '1') {
    const { error } = await sb.from('payments').delete().eq('student_id', sid).eq('month', month)
    if (error) back(path, error.message, true)
    back(path, 'اتلغى تسجيل الدفع')
  }
  const { data: s } = await sb.from('profiles').select('full_name, monthly_fee').eq('id', sid).single()
  if (!s) back(path, 'الطالب مش موجود', true)
  const { error } = await sb.from('payments').insert({ student_id: sid, month, amount: s.monthly_fee })
  if (error) back(path, error.message, true)
  back(path, `اتسجّل اشتراك ${s.full_name}`)
}

export async function addNotice(fd: FormData) {
  const { sb } = await staffOnly((me) => me.role === 'admin', '/reports')
  const g = str(fd, 'group')
  const { error } = await sb.from('notices').insert({ group_id: g === 'all' ? null : g, body: str(fd, 'body') })
  if (error) back('/reports', 'الإشعار متحفظش: ' + error.message, true)
  back('/reports', 'الإشعار جاهز. ابعته لأولياء الأمور من تحت')
}

// ---------- student ----------

/** Called after the photo is in storage. Returns an error message, or null. */
export async function submitSolution(assignmentId: string, path: string): Promise<string | null> {
  const { sb, me } = await getMe()
  if (me.role !== 'student') return 'الرفع للطلاب بس'
  if (!path.startsWith(me.id + '/') || path.includes('..')) return 'الصورة مش في المكان الصحيح'
  const { error } = await sb
    .from('submissions')
    .upsert(
      { assignment_id: assignmentId, student_id: me.id, photo_path: path, status: 'new', created_at: new Date().toISOString() },
      { onConflict: 'assignment_id,student_id' },
    )
  if (error) return 'الأستاذ راجع الحل ده خلاص، ومش هينفع يتبعت تاني'
  return null
}
