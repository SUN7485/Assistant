import Link from 'next/link'
import { notFound } from 'next/navigation'
import { can, need, isStaff } from '@/lib/me'
import { deleteStudent, enroll, resetPassword, saveStudent, setFee, unenroll } from '@/app/actions/people'
import { Stat } from '@/components/Stat'
import { Score } from '@/components/Score'
import { Spark } from '@/components/Spark'
import { Submit } from '@/components/Submit'
import { ATT, attendanceOf, average, fDay, feeOf, fTime, isId, level, money, pct } from '@/lib/util'

export default async function StudentFile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sb, me } = await need(isStaff)
  if (!isId(id)) notFound()
  const admin = me.role === 'admin'
  const { data: s } = await sb.from('profiles').select('id, full_name, phone, parent_phone').eq('id', id).eq('role', 'student').maybeSingle()
  if (!s) notFound()
  // A teacher gets only their own groups' side of the student: the database filters each of these.
  const [{ data: memberships }, { data: att }, { data: work }, { data: groups }] = await Promise.all([
    sb.from('enrollments').select('group:groups(id, name, monthly_fee, archived_at), special_fees(monthly_fee)').eq('student_id', id).order('joined_at'),
    sb.from('attendance').select('day, status, group_id').eq('student_id', id).order('day', { ascending: false }),
    sb.from('submissions').select('id, created_at, assignment:assignments(title, group_id), grades(correct, wrong, unclear, blank, note)').eq('student_id', id).order('created_at'),
    sb.from('groups').select('id, name, archived_at').order('created_at'),
  ])
  const mine = memberships ?? []
  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]))
  const many = new Set([...(att ?? []).map((r) => r.group_id), ...mine.map((m) => m.group.id)]).size > 1
  const a = attendanceOf(att ?? [])
  const graded = (work ?? []).flatMap((w) =>
    w.grades ? [{ ...w.grades, id: w.id, at: w.created_at, title: w.assignment.title, group: w.assignment.group_id, p: pct(w.grades.correct, w.grades.wrong) }] : [],
  )
  const av = average(graded.map((x) => x.p))
  const [lv] = level(av)
  const right = graded.reduce((t, x) => t + x.correct, 0), all = graded.reduce((t, x) => t + x.correct + x.wrong, 0)
  const free = (groups ?? []).filter((g) => !g.archived_at && !mine.some((m) => m.group.id === g.id))
  const here = `/students/${s.id}`

  return (
    <>
      <Link className="link back" href={mine[0] ? `/groups?g=${mine[0].group.id}` : '/students'}>→ رجوع {mine[0] ? 'للمجموعة' : 'للطلاب'}</Link>
      <div className="head">
        <div>
          <h1 className="h">{s.full_name}</h1>
          <div className="muted">موبايله <span dir="ltr">{s.phone}</span>{s.parent_phone && <> · ولي الأمر <span dir="ltr">{s.parent_phone}</span></>}</div>
        </div>
        {admin && <Link className="btn" href={`/reports?s=${s.id}`}>تقرير لولي الأمر</Link>}
      </div>

      <section className="panel">
        <h2>مجموعاته</h2>
        {mine.length ? (
          <ul className="list" id="memberships">
            {mine.map((m) => (
              <li key={m.group.id}>
                <div>
                  <Link className="link" href={`/groups?g=${m.group.id}`}><b>{m.group.name}</b></Link>
                  {m.group.archived_at && <span className="chip warn"> مؤرشفة</span>}
                  {can(me, 'see_payments') && <div className="muted small">الاشتراك {money(feeOf(m.group, m.special_fees))} في الشهر{m.special_fees ? ` (خاص — المجموعة ${money(m.group.monthly_fee)})` : ''}</div>}
                </div>
                {admin && (
                  <details className="inline">
                    <summary className="link small">تعديل</summary>
                    <form action={setFee} className="actions">
                      <input type="hidden" name="student" value={s.id} />
                      <input type="hidden" name="group" value={m.group.id} />
                      <input name="fee" type="number" min={0} step={10} defaultValue={m.special_fees?.monthly_fee ?? ''} placeholder={String(m.group.monthly_fee)} aria-label={`اشتراك خاص في ${m.group.name}`} className="short" />
                      <Submit className="btn sm ghost2">اشتراك خاص</Submit>
                      <span className="muted small">سيبه فاضي لو بيدفع اشتراك المجموعة ({money(m.group.monthly_fee)}).</span>
                    </form>
                    <form action={unenroll} className="actions">
                      <input type="hidden" name="student" value={s.id} />
                      <input type="hidden" name="group" value={m.group.id} />
                      <Submit className="btn sm ghost2 danger">شيله من المجموعة</Submit>
                      <span className="muted small">حضوره ودرجاته واشتراكاته اللي فاتت تفضل محفوظة.</span>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">مش في أي مجموعة دلوقتي.</p>
        )}
        {admin && free.length > 0 && (
          <details className="add">
            <summary>ضيفه لمجموعة {mine.length ? 'تانية' : ''}</summary>
            <form action={enroll} className="formgrid">
              <input type="hidden" name="student" value={s.id} />
              <label className="fld"><span>المجموعة</span>
                <select id="e-group" name="group">{free.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              </label>
              <Submit>ضيفه</Submit>
            </form>
          </details>
        )}
      </section>

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
                <div>
                  {can(me, 'grade') ? <Link className="link" href={`/grading/${x.id}`}><b>{x.title}</b></Link> : <b>{x.title}</b>}
                  <div className="muted small">{many && groupName.has(x.group) ? groupName.get(x.group) + ' · ' : ''}{fTime(x.at)}{x.note ? ' · ' + x.note : ''}</div>
                </div>
                <Score g={x} />
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
              <li key={r.group_id + r.day}>
                <span>{fDay(r.day)}{many && <span className="muted small"> · {groupName.get(r.group_id)}</span>}</span>
                <span className={'chip ' + ATT[r.status][1]}>{ATT[r.status][0]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">لسه مفيش حصص متسجلة.</p>
        )}
      </section>

      {admin && (
        <>
          <details className="panel add">
            <summary>تعديل بيانات الطالب</summary>
            <form action={saveStudent} className="formgrid">
              <input type="hidden" name="id" value={s.id} />
              <label className="fld"><span>الاسم</span><input id="p-name" name="name" defaultValue={s.full_name} required minLength={2} /></label>
              <label className="fld"><span>موبايله (بيدخل بيه)</span><input id="p-phone" name="phone" type="tel" defaultValue={s.phone} dir="ltr" required /></label>
              <label className="fld"><span>موبايل ولي الأمر</span><input id="p-parent" name="parent" type="tel" defaultValue={s.parent_phone ?? ''} dir="ltr" /></label>
              <Submit>حفظ</Submit>
            </form>
          </details>
          <details className="panel add">
            <summary>تغيير كلمة سر الطالب</summary>
            <form action={resetPassword} className="actions">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="back" value={here} />
              <input id="pw" name="password" aria-label="كلمة السر الجديدة" placeholder="كلمة السر الجديدة" minLength={6} required dir="ltr" />
              <Submit className="btn ghost2">غيّر</Submit>
            </form>
          </details>
          <details className="panel add sure">
            <summary>مسح حساب الطالب</summary>
            <p>للحساب اللي اتعمل بالغلط: بيتمسح ومعاه حضوره وحلوله ودرجاته، ومفيش رجوع. لو الطالب ساب السنتر بس، شيله من مجموعاته من فوق وكل حاجة تفضل محفوظة.</p>
            <form action={deleteStudent}>
              <input type="hidden" name="id" value={s.id} />
              <Submit className="btn sm danger">أيوه، امسح الحساب</Submit>
            </form>
          </details>
        </>
      )}
    </>
  )
}
