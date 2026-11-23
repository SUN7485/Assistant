import Link from 'next/link'
import { notFound } from 'next/navigation'
import { can, need, isStaff } from '@/lib/me'
import { deleteAssignment, saveAssignment } from '@/app/actions/groups'
import { Submit } from '@/components/Submit'
import { pagesLabel } from '@/lib/pages'
import { byName, dayOf, fDay, fTime, isId, nStudents, pct, wa } from '@/lib/util'

/** One homework: who sent their solution, who has not yet, and a nudge for each of those. */
export default async function Homework({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sb, me } = await need(isStaff)
  if (!isId(id)) notFound()
  const { data: w } = await sb.from('assignments').select('id, title, questions, created_at, group:groups(id, name)').eq('id', id).maybeSingle()
  if (!w) notFound()
  const [{ data: roster }, { data: subs }] = await Promise.all([
    sb.from('enrollments').select('student:profiles(id, full_name, phone, parent_phone)').eq('group_id', w.group.id),
    sb.from('submissions').select('id, student_id, status, created_at, photo_paths, grades(correct, wrong)').eq('assignment_id', id),
  ])
  const students = (roster ?? []).map((r) => r.student).sort(byName)
  const sub = new Map((subs ?? []).map((s) => [s.student_id, s]))
  const sent = students.filter((s) => sub.has(s.id)), missing = students.filter((s) => !sub.has(s.id))
  const grading = can(me, 'grade')

  return (
    <>
      <Link className="link back" href={`/groups?g=${w.group.id}`}>→ رجوع لـ {w.group.name}</Link>
      <div className="head">
        <div>
          <h1 className="h">{w.title}</h1>
          <div className="muted">{w.group.name} · {w.questions} سؤال · {fDay(dayOf(w.created_at))}</div>
        </div>
        <span className={'chip' + (students.length && !missing.length ? ' ok' : '')}>{sent.length} من {students.length} بعتوا الحل</span>
      </div>

      <section className="panel">
        <h2>لسه مبعتوش ({missing.length})</h2>
        {missing.length ? (
          <ul className="list" id="missing">
            {missing.map((s) => {
              const to = s.parent_phone ?? s.phone
              const text = s.parent_phone
                ? `السلام عليكم، ${s.full_name} لسه مبعتش حل واجب «${w.title}» (${w.group.name}). ياريت يصوّره ويبعته من المنصة. شكرًا لحضرتك.`
                : `${s.full_name}، لسه مبعتش حل واجب «${w.title}» (${w.group.name}). صوّره وابعته من المنصة.`
              return (
                <li key={s.id}>
                  <Link className="link" href={`/students/${s.id}`}><b>{s.full_name}</b></Link>
                  <a className="btn sm ghost2" target="_blank" rel="noopener" href={wa(to, text)}>{s.parent_phone ? 'فكّر ولي الأمر' : 'فكّر الطالب'}</a>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted">{students.length ? 'كل الطلاب بعتوا حلهم.' : 'المجموعة مفيهاش طلاب.'}</p>
        )}
      </section>

      <section className="panel">
        <h2>بعتوا الحل ({sent.length})</h2>
        {sent.length ? (
          <ul className="list" id="sent">
            {sent.map((s) => {
              const x = sub.get(s.id)!
              return (
                <li key={s.id}>
                  <div>
                    {grading ? <Link className="link" href={`/grading/${x.id}`}><b>{s.full_name}</b></Link> : <b>{s.full_name}</b>}
                    <div className="muted small">{fTime(x.created_at)} · {pagesLabel(x.photo_paths.length)}</div>
                  </div>
                  {x.grades ? (
                    <span className="score"><span className="ok">✓ {x.grades.correct}</span><span className="bad">✗ {x.grades.wrong}</span><b>{pct(x.grades.correct, x.grades.wrong)}%</b></span>
                  ) : (
                    <span className="chip warn">مستني تصحيح</span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted">لسه محدش بعت. الطالب بيصوّر حله ويبعته من موبايله.</p>
        )}
      </section>

      <details className="panel add">
        <summary>تعديل الواجب</summary>
        <form action={saveAssignment} className="formgrid">
          <input type="hidden" name="id" value={w.id} />
          <label className="fld"><span>اسم الواجب</span><input id="w-title" name="title" defaultValue={w.title} required minLength={2} /></label>
          <label className="fld"><span>عدد الأسئلة</span><input id="w-questions" name="questions" type="number" min={1} max={200} defaultValue={w.questions} required /></label>
          <Submit>حفظ</Submit>
        </form>
        {me.role === 'admin' && (
          <details className="sure">
            <summary>مسح الواجب</summary>
            <p>هيتمسح الواجب ومعاه {sent.length ? `حلول ${nStudents(sent.length)} وصورها ودرجاتها` : 'أي حلول تتبعت له'}. مفيش رجوع.</p>
            <form action={deleteAssignment}>
              <input type="hidden" name="id" value={w.id} />
              <Submit className="btn sm danger">أيوه، امسحه</Submit>
            </form>
          </details>
        )}
      </details>
    </>
  )
}
