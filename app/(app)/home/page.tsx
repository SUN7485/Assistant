import Link from 'next/link'
import { need, isAdmin } from '@/lib/me'
import { Stat } from '@/components/Stat'
import { average, daysAgo, fDay, fMonth, money, nStudents, pct, thisMonth, today } from '@/lib/util'

export default async function Home() {
  const { sb } = await need(isAdmin)
  const month = thisMonth()
  const [students, teachers, groups, roster, newWork, paid, att, graded] = await Promise.all([
    sb.from('profiles').select('id, full_name').eq('role', 'student'),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    sb.from('groups').select('id, name').is('archived_at', null),
    sb.from('enrollments').select('student_id, group_id, monthly_fee'),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    sb.from('payments').select('student_id, group_id, amount').eq('month', month),
    sb.from('attendance').select('group_id, student_id, day, status').gte('day', daysAgo(45)).order('day', { ascending: false }),
    sb.from('submissions').select('student_id, grades(correct, wrong)').eq('status', 'reviewed'),
  ])
  const ss = students.data ?? []
  const name = new Map(ss.map((s) => [s.id, s.full_name]))
  const group = new Map((groups.data ?? []).map((g) => [g.id, g.name]))
  const places = (roster.data ?? []).filter((e) => group.has(e.group_id)) // a place = one student in one running group
  const key = (student: string, g: string) => student + g
  const paidFor = new Set((paid.data ?? []).map((p) => key(p.student_id, p.group_id)))
  const unpaid = places.filter((e) => !paidFor.has(key(e.student_id, e.group_id)))
  const got = (paid.data ?? []).reduce((t, p) => t + p.amount, 0)
  const outstanding = unpaid.reduce((t, e) => t + e.monthly_fee, 0)
  const placed = new Set(places.map((e) => e.student_id))
  const loose = ss.filter((s) => !placed.has(s.id)).length

  // last class of each group
  const rows = (att.data ?? []).filter((r) => group.has(r.group_id))
  const lastDay = new Map<string, string>()
  rows.forEach((r) => lastDay.has(r.group_id) || lastDay.set(r.group_id, r.day))
  const last = rows.filter((r) => lastDay.get(r.group_id) === r.day)
  const lastPct = last.length ? Math.round((last.filter((r) => r.status !== 'absent').length / last.length) * 100) : null

  // absent from the last two classes of a group they are still in
  const recent = new Map<string, string[]>()
  rows.forEach((r) => recent.set(key(r.student_id, r.group_id), [...(recent.get(key(r.student_id, r.group_id)) ?? []), r.status]))
  const missing = places.filter((e) => {
    const st = recent.get(key(e.student_id, e.group_id))
    return st?.[0] === 'absent' && st[1] === 'absent' && name.has(e.student_id)
  })

  const marks = new Map<string, number[]>()
  ;(graded.data ?? []).forEach((x) => {
    if (x.grades) marks.set(x.student_id, [...(marks.get(x.student_id) ?? []), pct(x.grades.correct, x.grades.wrong)])
  })
  const weak = [...marks].map(([id, v]) => [id, average(v)!] as const).filter(([id, a]) => a < 50 && placed.has(id) && name.has(id))
  const n = newWork.count ?? 0

  const todo = [
    n > 0 && (
      <li key="w"><span>{n} حل جديد مستني تصحيح</span><Link className="btn sm" href="/grading">افتح التصحيح</Link></li>
    ),
    unpaid.length > 0 && (
      <li key="p"><span>{unpaid.length} اشتراك لسه متدفعش عن {fMonth(month)}</span><Link className="btn sm ghost2" href="/payments">الاشتراكات</Link></li>
    ),
    loose > 0 && (
      <li key="l"><span>{nStudents(loose)} مش في أي مجموعة</span><Link className="btn sm ghost2" href="/students?f=none">شوفهم</Link></li>
    ),
    ...missing.map((e) => (
      <li key={'a' + key(e.student_id, e.group_id)}><span><b>{name.get(e.student_id)}</b> غاب آخر حصتين ورا بعض في {group.get(e.group_id)}</span><Link className="btn sm ghost2" href={`/reports?s=${e.student_id}`}>بلّغ ولي الأمر</Link></li>
    )),
    ...weak.map(([id, a]) => (
      <li key={'g' + id}><span><b>{name.get(id)}</b> متوسط درجاته {a}% ومحتاج متابعة</span><Link className="btn sm ghost2" href={`/students/${id}`}>افتح ملفه</Link></li>
    )),
  ].filter(Boolean)

  if (!ss.length && !teachers.count)
    return (
      <>
        <h1 className="h">أهلاً بيك</h1>
        <section className="panel">
          <h2>تلات خطوات والمنصة تشتغل</h2>
          <ol className="steps">
            <li><Link className="link" href="/teachers">ضيف المدرسين</Link> وعلّم على صلاحيات كل واحد.</li>
            <li><Link className="link" href="/groups">اعمل المجموعات</Link> وضيف طلاب كل مجموعة — واحد واحد، أو الصق القائمة كلها مرة واحدة.</li>
            <li>ادّي كل طالب رقمه وكلمة السر، ويفتح المنصة من موبايله.</li>
          </ol>
        </section>
      </>
    )

  return (
    <>
      <h1 className="h">{fDay(today())}</h1>
      <div className="stats">
        <Stat v={ss.length} l="طالب" s={`في ${group.size} مجموعات مع ${teachers.count ?? 0} مدرسين`} />
        <Stat v={lastPct == null ? '—' : lastPct + '%'} l="نسبة الحضور" s="في آخر حصة لكل مجموعة" />
        <Stat v={n} l="حل مستني تصحيح" s="الطلاب رفعوه ولسه محدش صححه" />
        <Stat v={money(got)} l="اتحصّل الشهر ده" s={unpaid.length ? `فاضل ${money(outstanding)} — ${unpaid.length} اشتراك` : 'كل الاشتراكات اتدفعت'} />
      </div>
      <section className="panel">
        <h2>محتاج منك النهارده</h2>
        {todo.length ? <ul className="list">{todo}</ul> : <p className="muted">مفيش حاجة مستنياك. كل الحلول اتصححت وكل الاشتراكات اتحصّلت.</p>}
      </section>
    </>
  )
}
