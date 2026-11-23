import Link from 'next/link'
import { need, isAdmin } from '@/lib/me'
import { all } from '@/lib/data'
import { signupOpen } from '@/lib/schema'
import { Stat } from '@/components/Stat'
import { fDay, feeOf, fMonth, money, nStudents, thisMonth, today } from '@/lib/util'

export default async function Home() {
  const { sb } = await need(isAdmin)
  const month = thisMonth()
  // Lists are read whole (a page at a time); totals and flags come counted from the database.
  const [students, teachers, groups, roster, special, newWork, paid, lastClass, absent, weak, open] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    sb.from('groups').select('id, name, monthly_fee').is('archived_at', null),
    all((a, b) => sb.from('enrollments').select('student_id, group_id', { count: 'exact' }).order('student_id').order('group_id').range(a, b)),
    all((a, b) => sb.from('special_fees').select('student_id, group_id, monthly_fee', { count: 'exact' }).order('student_id').order('group_id').range(a, b)),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    all((a, b) => sb.from('payments').select('student_id, group_id, amount', { count: 'exact' }).eq('month', month).order('student_id').order('group_id').range(a, b)),
    sb.from('last_class').select('group_id, total, came'),
    sb.from('absent_twice').select('student_id, group_id').limit(50),
    sb.from('student_stats').select('student_id, group_id, average').lt('average', 50).limit(50),
    signupOpen(),
  ])
  const group = new Map((groups.data ?? []).map((g) => [g.id, g]))
  const places = roster.filter((e) => group.has(e.group_id)) // a place = one student in one running group
  const key = (student: string, g: string) => student + g
  const own = new Map(special.map((f) => [key(f.student_id, f.group_id), f]))
  const paidFor = new Set(paid.map((p) => key(p.student_id, p.group_id)))
  const unpaid = places.filter((e) => !paidFor.has(key(e.student_id, e.group_id)))
  const got = paid.reduce((t, p) => t + p.amount, 0)
  const outstanding = unpaid.reduce((t, e) => t + feeOf(group.get(e.group_id)!, own.get(key(e.student_id, e.group_id))), 0)
  const total = students.count ?? 0
  const loose = total - new Set(places.map((e) => e.student_id)).size

  const classes = (lastClass.data ?? []).filter((c) => c.group_id && group.has(c.group_id))
  const onRoll = classes.reduce((t, c) => t + (c.total ?? 0), 0)
  const lastPct = onRoll ? Math.round((classes.reduce((t, c) => t + (c.came ?? 0), 0) / onRoll) * 100) : null

  const missing = (absent.data ?? []).flatMap((x) => (x.student_id && x.group_id && group.has(x.group_id) ? [{ student: x.student_id, group: x.group_id }] : []))
  const behind = (weak.data ?? []).flatMap((x) => (group.has(x.group_id) && x.average != null ? [{ student: x.student_id, group: x.group_id, average: x.average }] : []))
  const flagged = [...new Set([...missing, ...behind].map((x) => x.student))]
  const { data: people } = flagged.length ? await sb.from('profiles').select('id, full_name').in('id', flagged) : { data: [] }
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]))
  const n = newWork.count ?? 0

  const todo = [
    open && (
      <li key="s"><span><b>التسجيل المفتوح شغّال في Supabase</b>، يعني أي حد يقدر يعمل لنفسه دخول. اقفله من Authentication ← Sign In / Providers ← Allow new users to sign up.</span></li>
    ),
    n > 0 && (
      <li key="w"><span>{n} حل جديد مستني تصحيح</span><Link className="btn sm" href="/grading">افتح التصحيح</Link></li>
    ),
    unpaid.length > 0 && (
      <li key="p"><span>{unpaid.length} اشتراك لسه متدفعش عن {fMonth(month)}</span><Link className="btn sm ghost2" href="/payments">الاشتراكات</Link></li>
    ),
    loose > 0 && (
      <li key="l"><span>{nStudents(loose)} مش في أي مجموعة</span><Link className="btn sm ghost2" href="/students?f=none">شوفهم</Link></li>
    ),
    ...missing.map((x) => (
      <li key={'a' + key(x.student, x.group)}><span><b>{name.get(x.student)}</b> غاب آخر حصتين ورا بعض في {group.get(x.group)!.name}</span><Link className="btn sm ghost2" href={`/reports?s=${x.student}`}>بلّغ ولي الأمر</Link></li>
    )),
    ...behind.map((x) => (
      <li key={'g' + key(x.student, x.group)}><span><b>{name.get(x.student)}</b> متوسط درجاته في {group.get(x.group)!.name} {x.average}% ومحتاج متابعة</span><Link className="btn sm ghost2" href={`/students/${x.student}`}>افتح ملفه</Link></li>
    )),
  ].filter(Boolean)

  if (!total && !teachers.count)
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
          {open && <p className="error">التسجيل المفتوح شغّال في Supabase. اقفله من Authentication ← Sign In / Providers ← Allow new users to sign up، علشان محدش غير اللي إنت تضيفهم يعمل دخول.</p>}
        </section>
      </>
    )

  return (
    <>
      <h1 className="h">{fDay(today())}</h1>
      <div className="stats">
        <Stat v={total} l="طالب" s={`في ${group.size} مجموعات مع ${teachers.count ?? 0} مدرسين`} />
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
