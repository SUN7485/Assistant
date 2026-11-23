'use server'

import { revalidatePath } from 'next/cache'
import { can, getMe } from '@/lib/me'
import { MAX_PAGES, pagesLabel } from '@/lib/pages'
import { back, int, isDay, str, today } from '@/lib/util'
import { removePhotos, staffOnly } from './shared'

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

/** A class written on the wrong day is taken back whole. */
export async function deleteAttendanceDay(fd: FormData) {
  const gid = str(fd, 'group'), day = str(fd, 'day')
  const path = `/attendance?g=${gid}&d=${day}`
  const { sb } = await staffOnly((me) => can(me, 'attendance'), path)
  if (!isDay(day)) back(path, 'اليوم مش صحيح', true)
  const { error } = await sb.from('attendance').delete().eq('group_id', gid).eq('day', day)
  if (error) back(path, 'الحصة متمسحتش: ' + error.message, true)
  back(path, 'اتمسح حضور اليوم ده')
}

// ---------- grading ----------

export async function grade(fd: FormData) {
  const id = str(fd, 'id')
  const path = `/grading/${id}`
  const { sb, me } = await staffOnly((me) => can(me, 'grade'), path)
  const { data: sub } = await sb.from('submissions').select('id, assignment:assignments(questions)').eq('id', id).maybeSingle()
  if (!sub) back('/grading', 'الحل ده مش موجود أو مش من طلابك', true)
  const q = sub.assignment.questions
  const correct = int(fd, 'correct'), wrong = int(fd, 'wrong')
  if (!(correct >= 0 && wrong >= 0)) back(path, 'اكتب عدد الصح والغلط بأرقام', true)
  if (correct + wrong > q) back(path, `الصح والغلط مع بعض أكتر من ${q} سؤال`, true)
  const note = str(fd, 'note').slice(0, 2000)
  const { error } = await sb
    .from('grades')
    .upsert({ submission_id: id, correct, wrong, note, graded_by: me.id, graded_at: new Date().toISOString() })
  if (error) back(path, 'الدرجة مترصدتش: ' + error.message, true)
  const { error: e2 } = await sb.from('submissions').update({ status: 'reviewed' }).eq('id', id)
  if (e2) back(path, 'الدرجة اترصدت بس الحل لسه ظاهر إنه مستني. جرّب تحفظ تاني: ' + e2.message, true)
  const { data: next } = await sb.from('submissions').select('id').eq('status', 'new').order('created_at').limit(1).maybeSingle()
  const done = `اترصدت: ${correct} من ${correct + wrong}`
  if (next) back(`/grading/${next.id}`, done + ' — ده الحل اللي بعده')
  back('/grading', done + ' — خلصت كل الحلول')
}

// ---------- student ----------

/** Called after the photos are in storage, with their paths in page order. Returns an error message, or null. */
export async function submitSolution(assignmentId: string, paths: string[]): Promise<string | null> {
  const { sb, me } = await getMe()
  if (me.role !== 'student') return 'الرفع للطلاب بس'
  if (!Array.isArray(paths) || !paths.length) return 'صوّر صفحة واحدة على الأقل'
  if (paths.length > MAX_PAGES) return `أقصى عدد ${pagesLabel(MAX_PAGES)} للحل الواحد`
  // Each page is "<student id>/<assignment id>-<anything>". The database checks the same thing.
  const prefix = `${me.id}/${assignmentId}-`
  const mine = (p: unknown) => typeof p === 'string' && p.startsWith(prefix) && !p.includes('..')
  if (!paths.every(mine) || new Set(paths).size !== paths.length) return 'الصور مش في المكان الصحيح'

  const { data: before } = await sb
    .from('submissions')
    .select('status, photo_paths')
    .eq('assignment_id', assignmentId)
    .eq('student_id', me.id)
    .maybeSingle()
  if (before?.status === 'reviewed') return 'الأستاذ راجع الحل ده خلاص، ومش هينفع يتبعت تاني'
  const { error } = await sb
    .from('submissions')
    .upsert(
      { assignment_id: assignmentId, student_id: me.id, photo_paths: paths, status: 'new', created_at: new Date().toISOString() },
      { onConflict: 'assignment_id,student_id' },
    )
  if (error) return 'الحل متبعتش. حدّث الصفحة وجرّب تاني، ولو فضلت المشكلة كلّم الأستاذ.'

  // Photos this replaced are no longer shown to anyone, so they leave storage. Students cannot delete
  // from storage themselves; the paths come from this student's own row, which was checked above.
  await removePhotos((before?.photo_paths ?? []).filter((p) => mine(p) && !paths.includes(p)))
  revalidatePath('/', 'layout')
  return null
}
