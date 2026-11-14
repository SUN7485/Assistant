import Link from 'next/link'
import { need, isAdmin } from '@/lib/me'
import { Stat } from '@/components/Stat'
import { average, daysAgo, fDay, fMonth, money, pct, thisMonth, today } from '@/lib/util'

export default async function Home() {
  const { sb } = await need(isAdmin)
  const month = thisMonth()
  const [students, teachers, groups, newWork, paid, att, graded] = await Promise.all([
    sb.from('profiles').select('id, full_name, monthly_fee').eq('role', 'student'),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    sb.from('groups').select('id', { count: 'exact', head: true }),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    sb.from('payments').select('student_id, amount').eq('month', month),
    sb.from('attendance').select('group_id, student_id, day, status').gte('day', daysAgo(45)).order('day', { ascending: false }),
    sb.from('submissions').select('student_id, grades(correct, wrong)').eq('status', 'reviewed'),
  ])
  const ss = students.data ?? []
  const paidIds = new Set((paid.data ?? []).map((p) => p.student_id))
  const unpaid = ss.filter((s) => !paidIds.has(s.id))
  const due = ss.reduce((t, s) => t + s.monthly_fee, 0)
  const got = (paid.data ?? []).reduce((t, p) => t + p.amount, 0)

  // last class of each group
  const rows = att.data ?? []
  const lastDay = new Map<string, string>()
  rows.forEach((r) => lastDay.has(r.group_id) || lastDay.set(r.group_id, r.day))
  const last = rows.filter((r) => lastDay.get(r.group_id) === r.day)
  const lastPct = last.length ? Math.round((last.filter((r) => r.status !== 'absent').length / last.length) * 100) : null

  // absent from their last two classes
  const byStudent = new Map<string, string[]>()
  rows.forEach((r) => byStudent.set(r.student_id, [...(byStudent.get(r.student_id) ?? []), r.status]))
  const name = new Map(ss.map((s) => [s.id, s.full_name]))
  const missing = [...byStudent].filter(([, st]) => st[0] === 'absent' && st[1] === 'absent').map(([id]) => id).filter((id) => name.has(id))

  const marks = new Map<string, number[]>()
  ;(graded.data ?? []).forEach((x) => {
    const g = x.grades as unknown as { correct: number; wrong: number } | null
    if (g) marks.set(x.student_id, [...(marks.get(x.student_id) ?? []), pct(g.correct, g.wrong)])
  })
  const weak = [...marks].map(([id, v]) => [id, average(v)!] as const).filter(([id, a]) => a < 50 && name.has(id))
  const n = newWork.count ?? 0

  const todo = [
    n > 0 && (
      <li key="w"><span>{n} حل جديد مستني تصحيح</span><Link className="btn sm" href="/grading">افتح التصحيح</Link></li>
    ),
    unpaid.length > 0 && (
      <li key="p"><span>{unpaid.length} طالب لسه مدفعوش اشتراك {fMonth(month)}</span><Link className="btn sm ghost2" href="/payments">الاشتراكات</Link></li>
    ),
    ...missing.map((id) => (
      <li key={'a' + id}><span><b>{name.get(id)}</b> غاب آخر حصتين ورا بعض</span><Link className="btn sm ghost2" href={`/reports?s=${id}`}>بلّغ ولي الأمر</Link></li>
    )),
    ...weak.map(([id, a]) => (
      <li key={'g' + id}><span><b>{name.get(id)}</b> متوسط درجاته {a}% ومحتاج متابعة</span><Link className="btn sm ghost2" href={`/students/${id}`}>افتح ملفه</Link></li>
    )),
  ].filter(Boolean)

  if (!ss.length && !teachers.count)
    return (
      <>
        <h1 className="h">أهلاً بيك</h1>
        <p className="empty">المنصة فاضية. ابدأ بإضافة <Link className="link" href="/teachers">المدرسين</Link>، وبعدين المجموعات والطلاب.</p>
      </>
    )

  return (
    <>
      <h1 className="h">{fDay(today())}</h1>
      <div className="stats">
        <Stat v={ss.length} l="طالب" s={`في ${groups.count ?? 0} مجموعات مع ${teachers.count ?? 0} مدرسين`} />
        <Stat v={lastPct == null ? '—' : lastPct + '%'} l="نسبة الحضور" s="في آخر حصة لكل مجموعة" />
        <Stat v={n} l="حل مستني تصحيح" s="الطلاب رفعوه ولسه محدش صححه" />
        <Stat v={money(got)} l="اتحصّل الشهر ده" s={`من ${money(due)} — فاضل ${unpaid.length} طالب`} />
      </div>
      <section className="panel">
        <h2>محتاج منك النهارده</h2>
        {todo.length ? <ul className="list">{todo}</ul> : <p className="muted">مفيش حاجة مستنياك. كل الحلول اتصححت وكل الاشتراكات اتحصّلت.</p>}
      </section>
    </>
  )
}
