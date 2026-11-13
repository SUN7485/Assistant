import Link from 'next/link'
import { notFound } from 'next/navigation'
import { need, isStaff } from '@/lib/me'
import { resetPassword } from '../../../actions'
import { Stat } from '@/components/Stat'
import { Spark } from '@/components/Spark'
import { Submit } from '@/components/Submit'
import { ATT, attendanceOf, average, fDay, fTime, level, pct } from '@/lib/util'

export default async function StudentFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sb, me } = await need(isStaff)
  const { data: s } = await sb.from('profiles').select('id, full_name, phone, parent_phone, group_id, group:groups!profiles_group_fk(name)').eq('id', id).eq('role', 'student').maybeSingle()
  if (!s) notFound()
  const [{ data: att }, { data: work }] = await Promise.all([
    sb.from('attendance').select('day, status').eq('student_id', id).order('day', { ascending: false }),
    sb.from('submissions').select('id, created_at, status, assignment:assignments(title), grades(correct, wrong, note, graded_at)').eq('student_id', id).order('created_at'),
  ])
  const a = attendanceOf(att ?? [])
  const graded = (work ?? []).flatMap((w) => {
    const g = w.grades as unknown as { correct: number; wrong: number; note: string } | null
    return g ? [{ ...g, id: w.id, at: w.created_at, title: (w.assignment as unknown as { title: string }).title, p: pct(g.correct, g.wrong) }] : []
  })
  const av = average(graded.map((x) => x.p))
  const [lv] = level(av)
  const right = graded.reduce((t, x) => t + x.correct, 0), all = graded.reduce((t, x) => t + x.correct + x.wrong, 0)
  const group = s.group as unknown as { name: string } | null

  return (
    <>
      <Link className="link back" href={`/groups?g=${s.group_id}`}>→ رجوع للمجموعة</Link>
      <div className="head">
        <div>
          <h1 className="h">{s.full_name}</h1>
          <div className="muted">{group?.name} · موبايله <span dir="ltr">{s.phone}</span>{s.parent_phone && <> · ولي الأمر <span dir="ltr">{s.parent_phone}</span></>}</div>
        </div>
        {me.role === 'admin' && <Link className="btn" href={`/reports?s=${s.id}`}>تقرير لولي الأمر</Link>}
      </div>
      <div className="stats">
        <Stat v={av == null ? '—' : av + '%'} l="متوسط الدرجات" s={'المستوى: ' + lv} />
        <Stat v={a.pct == null ? '—' : a.pct + '%'} l="نسبة الحضور" s={`حضر ${a.present} · اتأخر ${a.late} · غاب ${a.absent}`} />
        <Stat v={`${right} من ${all}`} l="إجابة صح" s="في كل الحلول اللي اتصححت" />
      </div>
      <section className="panel">
        <h2>الدرجات ومستواه</h2>
        <Spark values={graded.map((x) => x.p)} />
        {graded.length ? (
          <ul className="list">
            {graded.slice().reverse().map((x) => (
              <li key={x.id}>
                <div><b>{x.title}</b><div className="muted small">{fTime(x.at)}{x.note ? ' · ' + x.note : ''}</div></div>
                <div className="score"><span className="ok">✓ {x.correct}</span><span className="bad">✗ {x.wrong}</span><b>{x.p}%</b></div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">لسه مفيش حلول اتصححت.</p>
        )}
      </section>
      <section className="panel">
        <h2>الحضور والغياب</h2>
        {att?.length ? (
          <ul className="list">
            {att.map((r) => (
              <li key={r.day}><span>{fDay(r.day)}</span><span className={'chip ' + ATT[r.status][1]}>{ATT[r.status][0]}</span></li>
            ))}
          </ul>
        ) : (
          <p className="muted">لسه مفيش حصص متسجلة.</p>
        )}
      </section>
      {me.role === 'admin' && (
        <details className="panel add">
          <summary>تغيير كلمة سر الطالب</summary>
          <form action={resetPassword} className="actions">
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="back" value={`/students/${s.id}`} />
            <input id="pw" name="password" aria-label="كلمة السر الجديدة" placeholder="كلمة السر الجديدة" minLength={6} required dir="ltr" />
            <Submit className="btn ghost2">غيّر</Submit>
          </form>
        </details>
      )}
    </>
  )
}
