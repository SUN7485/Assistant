import Link from 'next/link'
import { can, need, isStaff } from '@/lib/me'
import { addAssignment, addGroup, addStudent } from '../../actions'
import { Submit } from '@/components/Submit'
import { attendanceOf, average, dayOf, fDay, fMonth, level, pct, thisMonth } from '@/lib/util'

export default async function Groups({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const { sb, me } = await need(isStaff)
  const admin = me.role === 'admin'
  const { data: groups } = await sb.from('groups').select('id, name, schedule, teacher:profiles!groups_teacher_id_fkey(full_name)').order('created_at')
  const { g: asked } = await searchParams
  const g = groups?.find((x) => x.id === asked) ?? groups?.[0]
  const teachers = admin ? (await sb.from('profiles').select('id, full_name, subject').eq('role', 'teacher').order('full_name')).data ?? [] : []
  const month = thisMonth()
  const showPay = can(me, 'see_payments')

  const addGroupForm = admin && (
    <details className="panel add" open={!groups?.length}>
      <summary>إضافة مجموعة</summary>
      {teachers.length ? (
        <form action={addGroup} className="formgrid">
          <label className="fld"><span>اسم المجموعة</span><input id="g-name" name="name" placeholder="مثلاً: تالتة ثانوي — السبت" required minLength={2} /></label>
          <label className="fld"><span>المدرس</span>
            <select id="g-teacher" name="teacher">{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} — {t.subject}</option>)}</select>
          </label>
          <label className="fld"><span>المواعيد</span><input id="g-schedule" name="schedule" placeholder="السبت والتلات 4:00 م" /></label>
          <Submit>إضافة المجموعة</Submit>
        </form>
      ) : (
        <p className="muted">ضيف مدرس الأول من <Link className="link" href="/teachers">المدرسين والصلاحيات</Link>.</p>
      )}
    </details>
  )

  if (!g)
    return (
      <>
        <h1 className="h">{admin ? 'المجموعات والطلاب' : 'مجموعاتي'}</h1>
        <p className="empty">{admin ? 'لسه مفيش مجموعات. ضيف أول مجموعة من تحت.' : 'مفيش مجموعات باسمك لسه. الإدارة بتضيفها.'}</p>
        {addGroupForm}
      </>
    )

  const [{ data: students }, { data: att }, { data: work }, { data: assignments }, pays] = await Promise.all([
    sb.from('profiles').select('id, full_name, phone, parent_phone').eq('group_id', g.id).eq('role', 'student').order('full_name'),
    sb.from('attendance').select('student_id, status').eq('group_id', g.id),
    sb.from('submissions').select('student_id, assignment_id, grades(correct, wrong), assignment:assignments!inner(group_id)').eq('assignment.group_id', g.id),
    sb.from('assignments').select('id, title, questions, created_at').eq('group_id', g.id).order('created_at', { ascending: false }),
    showPay ? sb.from('payments').select('student_id').eq('month', month) : Promise.resolve({ data: [] as { student_id: string }[] }),
  ])
  const paid = new Set((pays.data ?? []).map((p) => p.student_id))
  const marks = (sid: string) =>
    (work ?? [])
      .filter((w) => w.student_id === sid && w.grades)
      .map((w) => {
        const x = w.grades as unknown as { correct: number; wrong: number }
        return pct(x.correct, x.wrong)
      })
  const teacher = g.teacher as unknown as { full_name: string } | null

  return (
    <>
      <h1 className="h">{admin ? 'المجموعات والطلاب' : 'مجموعاتي'}</h1>
      {(groups?.length ?? 0) > 1 && (
        <div className="chips">
          {groups!.map((x) => (
            <Link key={x.id} href={`/groups?g=${x.id}`} className={'chipbtn' + (x.id === g.id ? ' on' : '')}>{x.name}</Link>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="row">
          <div>
            <h2>{g.name}</h2>
            <div className="muted">{teacher?.full_name}{g.schedule ? ' · ' + g.schedule : ''}</div>
          </div>
          <span className="chip">{students?.length ?? 0} طالب</span>
        </div>
        {students?.length ? (
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>الطالب</th><th>الحضور</th><th>متوسط الدرجات</th><th>المستوى</th>
                  {showPay && <th>اشتراك {fMonth(month)}</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const a = attendanceOf((att ?? []).filter((r) => r.student_id === s.id))
                  const av = average(marks(s.id))
                  const [lv, c] = level(av)
                  return (
                    <tr key={s.id}>
                      <td><b>{s.full_name}</b></td>
                      <td>{a.pct == null ? '—' : a.pct + '%'}</td>
                      <td>{av == null ? '—' : av + '%'}</td>
                      <td><span className={'chip ' + c}>{lv}</span></td>
                      {showPay && <td>{paid.has(s.id) ? <span className="chip ok">مدفوع</span> : <span className="chip bad">لسه</span>}</td>}
                      <td><Link className="link" href={`/students/${s.id}`}>ملف الطالب</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">المجموعة فاضية.{can(me, 'add_students') ? ' ضيف أول طالب من تحت.' : ''}</p>
        )}
      </section>

      <section className="panel">
        <h2>الواجبات</h2>
        {assignments?.length ? (
          <ul className="list">
            {assignments.map((w) => (
              <li key={w.id}>
                <div><b>{w.title}</b><div className="muted small">{w.questions} سؤال · {fDay(dayOf(w.created_at))}</div></div>
                <span className="chip">{(work ?? []).filter((x) => x.assignment_id === w.id).length} من {students?.length ?? 0} بعتوا الحل</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">لسه مفيش واجبات. ضيف الواجب بعد الحصة، والطلاب يصوّروا حله ويبعتوه.</p>
        )}
        <details className="add">
          <summary>واجب جديد</summary>
          <form action={addAssignment} className="formgrid">
            <input type="hidden" name="group" value={g.id} />
            <label className="fld"><span>اسم الواجب</span><input id="w-title" name="title" placeholder="مثلاً: تمارين التفاضل" required minLength={2} /></label>
            <label className="fld"><span>عدد الأسئلة</span><input id="w-questions" name="questions" type="number" min={1} max={200} defaultValue={20} required /></label>
            <Submit>إضافة الواجب</Submit>
          </form>
        </details>
      </section>

      {can(me, 'add_students') && (
        <details className="panel add">
          <summary>إضافة طالب</summary>
          <form action={addStudent} className="formgrid">
            <input type="hidden" name="group" value={g.id} />
            <label className="fld"><span>اسم الطالب</span><input id="s-name" name="name" required minLength={2} /></label>
            <label className="fld"><span>موبايل الطالب (هيدخل بيه)</span><input id="s-phone" name="phone" type="tel" placeholder="01xxxxxxxxx" pattern="01[0-9]{9}" dir="ltr" required /></label>
            <label className="fld"><span>كلمة السر</span><input id="s-password" name="password" minLength={6} dir="ltr" required /></label>
            <label className="fld"><span>موبايل ولي الأمر</span><input id="s-parent" name="parent" type="tel" placeholder="01xxxxxxxxx" pattern="01[0-9]{9}" dir="ltr" /></label>
            <label className="fld"><span>الاشتراك الشهري (ج.م)</span><input id="s-fee" name="fee" type="number" min={0} step={10} defaultValue={300} /></label>
            <Submit>إضافة الطالب</Submit>
          </form>
        </details>
      )}
      {addGroupForm}
    </>
  )
}

