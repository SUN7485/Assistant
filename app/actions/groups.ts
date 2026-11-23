'use server'

import { back, int, str } from '@/lib/util'
import { removePhotos, staffOnly } from './shared'

// ---------- groups ----------

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

export async function saveGroup(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/groups?g=${id}`
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  const { error } = await sb.from('groups').update({ name: str(fd, 'name'), teacher_id: str(fd, 'teacher'), schedule: str(fd, 'schedule') }).eq('id', id)
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
    sb.from(t).select('group_id', { count: 'exact', head: true }).eq('group_id', id).then((r) => r.count ?? 0)
  const used = (await Promise.all([count('enrollments'), count('assignments'), count('attendance'), count('payments')])).some(Boolean)
  if (used) back(path, 'المجموعة فيها طلاب أو واجبات أو حضور أو اشتراكات متسجلة، فمينفعش تتمسح. أرشفها بدل كده', true)
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
  // A grade already given cannot end up with more answers than the homework has questions.
  const { data: graded } = await sb.from('submissions').select('grades(correct, wrong)').eq('assignment_id', id)
  const most = Math.max(0, ...(graded ?? []).map((s) => (s.grades ? s.grades.correct + s.grades.wrong : 0)))
  if (questions < most) back(path, `فيه حل اتصحح على ${most} سؤال، فعدد الأسئلة مينفعش يقل عن كده`, true)
  const { data, error } = await sb.from('assignments').update({ title: str(fd, 'title'), questions }).eq('id', id).select('id')
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
