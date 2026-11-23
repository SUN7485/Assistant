import Link from 'next/link'
import { can, need, isStaff } from '@/lib/me'
import { addAssignment, addGroup, archiveGroup, deleteGroup, saveGroup } from '@/app/actions/groups'
import { addStudent } from '@/app/actions/people'
import { BulkAdd } from '@/components/BulkAdd'
import { Submit } from '@/components/Submit'
import { attendanceOf, average, byName, dayOf, fDay, fMonth, level, nStudents, pct, thisMonth } from '@/lib/util'

export default async function Groups({ searchParams }: { searchParams: Promise<{ g?: string; archived?: string }> }) {
  const { sb, me } = await need(isStaff)
  const admin = me.role === 'admin'
  const { g: asked, archived } = await searchParams
  const { data: all } = await sb
    .from('groups')
    .select('id, name, schedule, archived_at, teacher_id, teacher:profiles!groups_teacher_id_fkey(full_name)')
    .order('created_at')
  const live = (all ?? []).filter((x) => !x.archived_at), put = (all ?? []).filter((x) => x.archived_at)
  const shown = archived ? put : live
  const g = all?.find((x) => x.id === asked) ?? shown[0]
  const teachers = admin ? ((await sb.from('profiles').select('id, full_name, subject').eq('role', 'teacher').order('full_name')).data ?? []) : []
  const month = thisMonth()
  const showPay = can(me, 'see_payments')
  const title = <h1 className="h">{admin ? 'المجموعات' : 'مجموعاتي'}</h1>
  const teacherPick = (id: string, chosen?: string) => (
    <label className="fld"><span>المدرس</span>
      <select id={id} name="teacher" defaultValue={chosen}>{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} — {t.subject}</option>)}</select>
    </label>
  )

  const addGroupForm = admin && !archived && (
    <details className="panel add" open={!all?.length}>
      <summary>إضافة مجموعة</summary>
      {teachers.length ? (
        <form action={addGroup} className="formgrid">
          <label className="fld"><span>اسم المجموعة</span><input id="g-name" name="name" placeholder="مثلاً: تالتة ثانوي — السبت" required minLength={2} /></label>
          {teacherPick('g-teacher')}
          <label className="fld"><span>المواعيد</span><input id="g-schedule" name="schedule" placeholder="السبت والتلات 4:00 م" /></label>
          <Submit>إضافة المجموعة</Submit>
        </form>
      ) : (
        <p className="muted">ضيف مدرس الأول من <Link className="link" href="/teachers">المدرسين</Link>.</p>
      )}
    </details>
  )
  const archiveLink = admin && put.length > 0 && (
    <Link className="link small" href={archived ? '/groups' : '/groups?archived=1'}>{archived ? '→ رجوع للمجموعات الشغالة' : `المجموعات المؤرشفة (${put.length})`}</Link>
  )

  if (!g)
    return (
      <>
        {title}
        <p className="empty">{archived ? 'مفيش مجموعات مؤرشفة.' : admin ? 'لسه مفيش مجموعات. ضيف أول مجموعة من تحت.' : 'مفيش مجموعات باسمك لسه. الإدارة بتضيفها.'}</p>
        {addGroupForm}
        {archiveLink}
      </>
    )

  const [{ data: roster }, { data: att }, { data: work }, { data: assignments }, pays] = await Promise.all([
    sb.from('enrollments').select('monthly_fee, student:profiles(id, full_name)').eq('group_id', g.id),
    sb.from('attendance').select('student_id, status').eq('group_id', g.id),
    sb.from('submissions').select('student_id, assignment_id, grades(correct, wrong), assignment:assignments!inner(group_id)').eq('assignment.group_id', g.id),
    sb.from('assignments').select('id, title, questions, created_at').eq('group_id', g.id).order('created_at', { ascending: false }),
    showPay ? sb.from('payments').select('student_id').eq('group_id', g.id).eq('month', month) : null,
  ])
  const students = (roster ?? []).map((r) => r.student).sort(byName)
  const here = new Set(students.map((s) => s.id))
  const paid = new Set((pays?.data ?? []).map((p) => p.student_id))
  const marks = (sid: string) => (work ?? []).flatMap((w) => (w.student_id === sid && w.grades ? [pct(w.grades.correct, w.grades.wrong)] : []))

  return (
    <>
      {title}
      {shown.length > 1 && (
        <div className="chips">
          {shown.map((x) => (
            <Link key={x.id} href={`/groups?g=${x.id}${archived ? '&archived=1' : ''}`} className={'chipbtn' + (x.id === g.id ? ' on' : '')}>{x.name}</Link>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="row">
          <div>
            <h2>{g.name}</h2>
            <div className="muted">{g.teacher?.full_name}{g.schedule ? ' · ' + g.schedule : ''}</div>
          </div>
          <div className="actions">
            {g.archived_at && <span className="chip warn">مؤرشفة</span>}
            <span className="chip">{nStudents(students.length)}</span>
          </div>
        </div>
        {students.length ? (
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
                      <td><Link className="link plain" href={`/students/${s.id}`}><b>{s.full_name}</b></Link></td>
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
          <p className="muted">المجموعة فاضية.{can(me, 'add_students') && !g.archived_at ? ' ضيف أول طالب من تحت.' : ''}</p>
        )}
        {admin && (
          <details className="add">
            <summary>تعديل المجموعة</summary>
            <form action={saveGroup} className="formgrid">
              <input type="hidden" name="id" value={g.id} />
              <label className="fld"><span>اسم المجموعة</span><input name="name" defaultValue={g.name} required minLength={2} /></label>
              {teacherPick('e-teacher', g.teacher_id)}
              <label className="fld"><span>المواعيد</span><input name="schedule" defaultValue={g.schedule} /></label>
              <Submit>حفظ</Submit>
            </form>
            <div className="actions sep">
              <form action={archiveGroup}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="archive" value={g.archived_at ? '0' : '1'} />
                <Submit className="btn sm ghost2">{g.archived_at ? 'رجّعها تشتغل' : 'أرشفة المجموعة'}</Submit>
              </form>
              <span className="muted small">{g.archived_at ? 'هترجع تظهر في الحضور والاشتراكات.' : 'للمجموعات اللي خلصت (السنة اللي فاتت مثلاً): تختفي من الشغل اليومي، وكل اللي اتسجل فيها يفضل محفوظ.'}</span>
            </div>
            {!students.length && !assignments?.length && (
              <form action={deleteGroup} className="actions">
                <input type="hidden" name="id" value={g.id} />
                <Submit className="btn sm ghost2 danger">مسح المجموعة</Submit>
                <span className="muted small">بتتمسح بس لو لسه متسجلش فيها حاجة.</span>
              </form>
            )}
          </details>
        )}
      </section>

      <section className="panel">
        <h2>الواجبات</h2>
        {assignments?.length ? (
          <ul className="list">
            {assignments.map((w) => {
              const sent = (work ?? []).filter((x) => x.assignment_id === w.id && here.has(x.student_id)).length
              return (
                <li key={w.id}>
                  <div><Link className="link" href={`/homework/${w.id}`}><b>{w.title}</b></Link><div className="muted small">{w.questions} سؤال · {fDay(dayOf(w.created_at))}</div></div>
                  <Link className={'chip' + (students.length && sent === students.length ? ' ok' : '')} href={`/homework/${w.id}`}>{sent} من {students.length} بعتوا الحل</Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted">لسه مفيش واجبات. ضيف الواجب بعد الحصة، والطلاب يصوّروا حله ويبعتوه.</p>
        )}
        {!g.archived_at && (
          <details className="add">
            <summary>واجب جديد</summary>
            <form action={addAssignment} className="formgrid">
              <input type="hidden" name="group" value={g.id} />
              <label className="fld"><span>اسم الواجب</span><input id="w-title" name="title" placeholder="مثلاً: تمارين التفاضل" required minLength={2} /></label>
              <label className="fld"><span>عدد الأسئلة</span><input id="w-questions" name="questions" type="number" min={1} max={200} defaultValue={20} required /></label>
              <Submit>إضافة الواجب</Submit>
            </form>
          </details>
        )}
      </section>

      {can(me, 'add_students') && !g.archived_at && (
        <>
          <details className="panel add">
            <summary>إضافة طالب</summary>
            <form action={addStudent} className="formgrid">
              <input type="hidden" name="group" value={g.id} />
              <label className="fld"><span>اسم الطالب</span><input id="s-name" name="name" required minLength={2} /></label>
              <label className="fld"><span>موبايل الطالب (هيدخل بيه)</span><input id="s-phone" name="phone" type="tel" placeholder="01xxxxxxxxx" dir="ltr" required /></label>
              <label className="fld"><span>كلمة السر</span><input id="s-password" name="password" minLength={6} dir="ltr" required /></label>
              <label className="fld"><span>موبايل ولي الأمر</span><input id="s-parent" name="parent" type="tel" placeholder="01xxxxxxxxx" dir="ltr" /></label>
              <label className="fld"><span>اشتراك المجموعة دي في الشهر (ج.م)</span><input id="s-fee" name="fee" type="number" min={0} step={10} defaultValue={300} /></label>
              <Submit>إضافة الطالب</Submit>
            </form>
            <p className="muted small">الطالب عنده حساب في مجموعة تانية؟ اكتب نفس رقم موبايله، وهيتضاف هنا بنفس حسابه.</p>
          </details>
          <details className="panel add">
            <summary>إضافة قائمة طلاب مرة واحدة</summary>
            <BulkAdd group={g.id} />
          </details>
        </>
      )}
      {addGroupForm}
      {archiveLink}
    </>
  )
}
