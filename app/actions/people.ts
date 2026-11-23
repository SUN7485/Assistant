'use server'

import { can, type Me } from '@/lib/me'
import { adminDb, type Db } from '@/lib/supabase'
import { parseRoster } from '@/lib/roster'
import { PHONE, back, int, isId, localPath, loginEmail, phone, str } from '@/lib/util'
import { createAccount, dropAccount, easyPassword, removePhotos, staffOnly, whoHas } from './shared'

// ---------- teachers ----------

export async function addTeacher(fd: FormData) {
  await staffOnly((me) => me.role === 'admin', '/teachers')
  const made = await createAccount(phone(fd, 'phone'), String(fd.get('password') ?? ''), {
    role: 'teacher',
    full_name: str(fd, 'name'),
    subject: str(fd, 'subject'),
  })
  if ('error' in made) back('/teachers', made.error, true)
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

/** The login is the phone number, so a new number is changed in both places, and put back if the second refuses. */
async function changePhone(sb: Db, id: string, from: string, to: string): Promise<string | null> {
  if (!PHONE.test(to)) return 'رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01'
  const admin = adminDb()
  const { error } = await admin.auth.admin.updateUserById(id, { email: loginEmail(to), email_confirm: true })
  if (error) return error.code === 'email_exists' ? 'الرقم ده عنده حساب تاني' : 'الرقم متغيرش: ' + error.message
  const { error: e2 } = await sb.from('profiles').update({ phone: to }).eq('id', id)
  if (e2) {
    await admin.auth.admin.updateUserById(id, { email: loginEmail(from), email_confirm: true })
    return 'الرقم متغيرش: ' + e2.message
  }
  return null
}

export async function saveTeacher(fd: FormData) {
  const { sb } = await staffOnly((me) => me.role === 'admin', '/teachers')
  const id = str(fd, 'id')
  const { data: t } = await sb.from('profiles').select('phone').eq('id', id).eq('role', 'teacher').maybeSingle()
  if (!t) back('/teachers', 'المدرس ده مش موجود', true)
  // the number first: if it is refused, nothing else has changed
  const to = phone(fd, 'phone')
  if (to !== t.phone) {
    const problem = await changePhone(sb, id, t.phone, to)
    if (problem) back('/teachers', problem, true)
  }
  const { error } = await sb.from('profiles').update({ full_name: str(fd, 'name'), subject: str(fd, 'subject') }).eq('id', id)
  if (error) back('/teachers', 'البيانات متحفظتش: ' + error.message, true)
  back('/teachers', to !== t.phone ? 'اتحفظت البيانات. المدرس هيدخل بالرقم الجديد من دلوقتي' : 'اتحفظت بيانات المدرس')
}

export async function resetPassword(fd: FormData) {
  const path = localPath(fd, '/home')
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const id = str(fd, 'id')
  const password = String(fd.get('password') ?? '')
  if (password.length < 6) back(path, 'كلمة السر لازم تكون 6 حروف أو أرقام على الأقل', true)
  // The manager's own password is changed from "حسابي", where the current one is asked for.
  const { data: who } = await sb.from('profiles').select('role').eq('id', id).maybeSingle()
  if (!who || who.role === 'admin') back(path, 'الحساب ده مش موجود', true)
  const { error } = await adminDb().auth.admin.updateUserById(id, { password })
  if (error) back(path, 'كلمة السر متغيرتش: ' + error.message, true)
  back(path, 'اتغيرت كلمة السر. ابعتها لصاحب الحساب')
}

// ---------- students ----------

type Added = { ok: true; text: string; password?: string } | { ok: false; text: string }

/**
 * Puts one student in a group. Call only after groupToAddTo() has checked the caller and the group:
 * the database lets only the manager write enrollments, so a teacher's new student is written with the service key.
 * A number that already has a student account (they take another subject here) is the manager's to place:
 * a teacher could otherwise pull any student of the centre into their group, and read their details.
 */
async function addOne(me: Me, sb: Db, gid: string, s: { name: string; phone: string; parent: string; password: string }): Promise<Added> {
  if (!PHONE.test(s.phone)) return { ok: false, text: 'رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01' }
  if (s.parent && !PHONE.test(s.parent)) return { ok: false, text: 'رقم ولي الأمر لازم يكون 11 رقم ويبدأ بـ 01' }
  const owner = await whoHas(s.phone)
  if (owner && me.role !== 'admin') return { ok: false, text: 'الرقم ده عنده حساب في السنتر قبل كده. الإدارة هي اللي تضيفه لمجموعتك' }
  if (owner && owner.role !== 'student') return { ok: false, text: `الرقم ده بتاع ${owner.role === 'admin' ? 'مدير المنصة' : 'المدرس ' + owner.full_name}` }
  if (owner) {
    const { error } = await sb.from('enrollments').insert({ student_id: owner.id, group_id: gid })
    if (error) return { ok: false, text: error.code === '23505' ? `${owner.full_name} عنده حساب وموجود في المجموعة دي قبل كده` : 'الطالب متضافش: ' + error.message }
    return { ok: true, text: `الرقم ده بتاع ${owner.full_name} وعنده حساب، فاتضاف للمجموعة دي بنفس حسابه وكلمة سره` }
  }
  if (s.name.length < 2) return { ok: false, text: 'اكتب اسم الطالب' }
  const made = await createAccount(s.phone, s.password, { role: 'student', full_name: s.name, parent_phone: s.parent || null })
  if ('error' in made) return { ok: false, text: made.error }
  const { error } = await adminDb().from('enrollments').insert({ student_id: made.id, group_id: gid })
  if (error) {
    await dropAccount(made.id)
    return { ok: false, text: 'الطالب متضافش: ' + error.message }
  }
  return { ok: true, text: 'اتضاف الطالب. ادّيله رقمه وكلمة السر', password: s.password }
}

/** The group, if the caller may add students to it. A teacher only sees their own groups, so this also checks it is theirs. */
async function groupToAddTo(gid: string, path: string) {
  const r = await staffOnly((me) => can(me, 'add_students'), path)
  const { data: g } = await r.sb.from('groups').select('id').eq('id', gid).maybeSingle()
  if (!g) back(path, 'مش مسموح لك تضيف طلاب في المجموعة دي', true)
  return r
}

export async function addStudent(fd: FormData) {
  const gid = str(fd, 'group')
  const path = `/groups?g=${gid}`
  const { sb, me } = await groupToAddTo(gid, path)
  const r = await addOne(me, sb, gid, {
    name: str(fd, 'name'),
    phone: phone(fd, 'phone'),
    parent: phone(fd, 'parent'),
    password: String(fd.get('password') ?? ''),
  })
  back(path, r.text, !r.ok)
}

export type BulkResult = {
  made: { name: string; phone: string; password: string | null; note: string }[]
  skipped: { line: string; why: string }[]
  error?: string
}

/**
 * A pasted list, one student per line: the name, the student's number, and optionally the parent's number.
 * Each new student gets an eight-digit password, shown once in the result.
 */
export async function addStudents(_: BulkResult | null, fd: FormData): Promise<BulkResult> {
  const gid = str(fd, 'group')
  const { sb, me } = await groupToAddTo(gid, `/groups?g=${gid}`)
  const lines = parseRoster(str(fd, 'list'))
  const out: BulkResult = { made: [], skipped: [] }
  if (!lines.length) return { ...out, error: 'الصق قائمة الطلاب: كل طالب في سطر' }
  if (lines.length > 40) return { ...out, error: 'أقصى عدد 40 طالب في المرة. قسّم القائمة.' }
  const seen = new Set<string>()
  const todo = lines.filter(({ line, phone }) => {
    if (!phone) out.skipped.push({ line, why: 'مفيش رقم موبايل في السطر' })
    else if (seen.has(phone)) out.skipped.push({ line, why: 'الرقم متكرر في القائمة' })
    else return seen.add(phone)
  })
  // A few at a time: fast enough to finish well inside the server's time limit, gentle on the login service.
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4)
    const done = await Promise.all(batch.map((s) => addOne(me, sb, gid, { name: s.name, phone: s.phone, parent: s.parent, password: easyPassword() })))
    done.forEach((r, j) => {
      const s = batch[j]
      if (!r.ok) out.skipped.push({ line: s.line, why: r.text })
      else out.made.push({ name: s.name, phone: s.phone, password: r.password ?? null, note: r.password ? '' : 'عنده حساب قبل كده' })
    })
  }
  return out
}

/** The manager puts a student who already has an account into one more group. */
export async function enroll(fd: FormData) {
  const sid = str(fd, 'student'), gid = str(fd, 'group')
  const path = `/students/${sid}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const { error } = await sb.from('enrollments').insert({ student_id: sid, group_id: gid })
  if (error) back(path, error.code === '23505' ? 'هو في المجموعة دي قبل كده' : 'متضافش للمجموعة: ' + error.message, true)
  back(path, 'اتضاف للمجموعة')
}

/** Leaving a group keeps what was recorded there: attendance, solutions, grades and payments. */
export async function unenroll(fd: FormData) {
  const sid = str(fd, 'student'), gid = str(fd, 'group')
  const path = `/students/${sid}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const { error } = await sb.from('enrollments').delete().eq('student_id', sid).eq('group_id', gid)
  if (error) back(path, 'متشالش من المجموعة: ' + error.message, true)
  back(path, 'اتشال من المجموعة. اللي اتسجل له فيها قبل كده لسه محفوظ')
}

/** A student who pays something other than the group's fee. An empty field, or the group's own fee, puts them back on it. */
export async function setFee(fd: FormData) {
  const sid = str(fd, 'student'), gid = str(fd, 'group')
  const path = `/students/${sid}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const { data: g } = await sb.from('groups').select('monthly_fee').eq('id', gid).maybeSingle()
  if (!g) back(path, 'المجموعة دي مش موجودة', true)
  const typed = str(fd, 'fee'), fee = int(fd, 'fee')
  if (typed !== '' && !(fee >= 0)) back(path, 'اكتب الاشتراك بالأرقام', true)
  const usual = typed === '' || fee === g.monthly_fee
  const { error } = usual
    ? await sb.from('special_fees').delete().eq('student_id', sid).eq('group_id', gid)
    : await sb.from('special_fees').upsert({ student_id: sid, group_id: gid, monthly_fee: fee })
  if (error) back(path, 'الاشتراك متغيرش: ' + error.message, true)
  back(path, usual ? 'رجع على اشتراك المجموعة العادي' : 'اتسجّل له اشتراك خاص. الشهور اللي اتدفعت قبل كده زي ما هي')
}

export async function saveStudent(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/students/${id}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const { data: s } = await sb.from('profiles').select('phone').eq('id', id).eq('role', 'student').maybeSingle()
  if (!s) back('/students', 'الطالب ده مش موجود', true)
  const parent = phone(fd, 'parent')
  if (parent && !PHONE.test(parent)) back(path, 'رقم ولي الأمر لازم يكون 11 رقم ويبدأ بـ 01', true)
  // the number first: if it is refused, nothing else has changed
  const to = phone(fd, 'phone')
  if (to !== s.phone) {
    const problem = await changePhone(sb, id, s.phone, to)
    if (problem) back(path, problem, true)
  }
  const { error } = await sb.from('profiles').update({ full_name: str(fd, 'name'), parent_phone: parent || null }).eq('id', id)
  if (error) back(path, 'البيانات متحفظتش: ' + error.message, true)
  back(path, to !== s.phone ? 'اتحفظت البيانات. الطالب هيدخل بالرقم الجديد من دلوقتي' : 'اتحفظت بيانات الطالب')
}

/** For an account made by mistake. A student with payments recorded is taken out of their groups instead, so the money history stays. */
export async function deleteStudent(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/students/${id}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  if (!isId(id)) back('/students', 'الطالب ده مش موجود', true)
  const [who, paid, work] = await Promise.all([
    sb.from('profiles').select('full_name').eq('id', id).eq('role', 'student').maybeSingle(),
    sb.from('payments').select('month', { count: 'exact', head: true }).eq('student_id', id),
    sb.from('submissions').select('photo_paths').eq('student_id', id),
  ])
  // Deleting cannot be undone, so not knowing is a reason to stop.
  if (who.error || paid.error || work.error || paid.count == null) back(path, 'مقدرناش نتأكد من بيانات الطالب. جرّب تاني', true)
  if (!who.data) back('/students', 'الطالب ده مش موجود', true)
  if (paid.count) back(path, 'الطالب ده ليه اشتراكات متسجلة، فمينفعش يتمسح. شيله من مجموعاته بدل كده وحساباته تفضل محفوظة', true)
  const { error } = await adminDb().auth.admin.deleteUser(id)
  if (error) back(path, 'الحساب متمسحش: ' + error.message, true)
  await removePhotos((work.data ?? []).flatMap((w) => w.photo_paths))
  back('/students', `اتمسح حساب ${who.data.full_name}`)
}
