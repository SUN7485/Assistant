'use server'

import { back, int, str } from '@/lib/util'
import { removePhotos, staffOnly } from './shared'

// ---------- groups ----------

export async function addGroup(fd: FormData) {
  const { sb } = await staffOnly((me) => me.role === 'admin', '/groups')
  const fee = int(fd, 'fee')
  if (!(fee >= 0)) back('/groups', 'اكتب اشتراك المجموعة في الشهر بالأرقام (صفر لو مفيش)', true)
  const { data, error } = await sb
    .from('groups')
    .insert({ name: str(fd, 'name'), teacher_id: str(fd, 'teacher'), schedule: str(fd, 'schedule'), monthly_fee: fee })
    .select('id')
    .single()
  if (error) back('/groups', 'المجموعة متضافتش: ' + error.message, true)
  back(`/groups?g=${data.id}`, 'اتضافت المجموعة')
}

export async function saveGroup(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/groups?g=${id}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const fee = int(fd, 'fee')
  if (!(fee >= 0)) back(path, 'اكتب اشتراك المجموعة في الشهر بالأرقام (صفر لو مفيش)', true)
  const { error } = await sb.from('groups').update({ name: str(fd, 'name'), teacher_id: str(fd, 'teacher'), schedule: str(fd, 'schedule'), monthly_fee: fee }).eq('id', id)
  if (error) back(path, 'المجموعة متحفظتش: ' + error.message, true)
  back(path, 'اتحفظت بيانات المجموعة')
}

/** Last year's group is put away with everything recorded in it, and can be brought back. */
export async function archiveGroup(fd: FormData) {
  const id = str(fd, 'id')
  const { sb } = await staffOnly((me) => me.role === 'admin', `/groups?g=${id}`)
  const away = fd.get('archive') === '1'
  const { error } = await sb.from('groups').update({ archived_at: away ? new Date().toISOString() : null }).eq('id', id)
  if (error) back(`/groups?g=${id}`, error.message, true)
  if (away) back('/groups', 'المجموعة اتأرشفت. كل اللي اتسجل فيها محفوظ، وتقدر ترجّعها من «المجموعات المؤرشفة»')
  back(`/groups?g=${id}`, 'المجموعة رجعت تشتغل')
}

/** Only a group made by mistake: once anything is recorded in it, it is archived instead. */
export async function deleteGroup(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/groups?g=${id}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const count = (t: 'enrollments' | 'assignments' | 'attendance' | 'payments') =>
    sb.from(t).select('group_id', { count: 'exact', head: true }).eq('group_id', id).then((r) => (r.error ? null : r.count))
  const counts = await Promise.all([count('enrollments'), count('assignments'), count('attendance'), count('payments')])
  // Deleting cannot be undone, so not knowing is a reason to stop.
  if (counts.some((n) => n == null)) back(path, 'مقدرناش نتأكد إن المجموعة فاضية. جرّب تاني', true)
  if (counts.some(Boolean)) back(path, 'المجموعة فيها طلاب أو واجبات أو حضور أو اشتراكات متسجلة، فمينفعش تتمسح. أرشفها بدل كده', true)
  const { error } = await sb.from('groups').delete().eq('id', id)
  if (error) back(path, 'المجموعة متمسحتش: ' + error.message, true)
  back('/groups', 'اتمسحت المجموعة')
}

// ---------- homework ----------

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

export async function saveAssignment(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/homework/${id}`
  const { sb } = await staffOnly((me) => me.role !== 'student', path)
  const questions = int(fd, 'questions')
  if (!(questions >= 1 && questions <= 200)) back(path, 'عدد الأسئلة من 1 لـ 200', true)
  // A grade already given cannot end up with more answers than the homework has questions (the database holds this too).
  const { data: graded } = await sb.from('submissions').select('grades(correct, wrong, unclear, blank)').eq('assignment_id', id)
  const most = Math.max(0, ...(graded ?? []).map((s) => (s.grades ? s.grades.correct + s.grades.wrong + s.grades.unclear + s.grades.blank : 0)))
  if (questions < most) back(path, `فيه حل اتصحح على ${most} سؤال، فعدد الأسئلة مينفعش يقل عن كده`, true)
  const { data, error } = await sb.from('assignments').update({ title: str(fd, 'title'), questions }).eq('id', id).select('id')
  if (error?.message.includes('already graded')) back(path, 'فيه حل اتصحح على أسئلة أكتر من كده، فعدد الأسئلة مينفعش يقل', true)
  if (error || !data?.length) back(path, 'الواجب متحفظش' + (error ? ': ' + error.message : ''), true)
  back(path, 'اتحفظ الواجب')
}

/** Takes the solutions, their photos and their grades with it, so only the manager does it. */
export async function deleteAssignment(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/homework/${id}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const [{ data: w }, { data: work }] = await Promise.all([
    sb.from('assignments').select('group_id').eq('id', id).maybeSingle(),
    sb.from('submissions').select('photo_paths').eq('assignment_id', id),
  ])
  if (!w) back('/groups', 'الواجب ده مش موجود', true)
  const { error } = await sb.from('assignments').delete().eq('id', id)
  if (error) back(path, 'الواجب متمسحش: ' + error.message, true)
  await removePhotos((work ?? []).flatMap((s) => s.photo_paths))
  back(`/groups?g=${w.group_id}`, 'اتمسح الواجب وحلوله')
}
