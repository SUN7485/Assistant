import { need, isAdmin } from '@/lib/me'
import { addNotice, deleteNotice } from '@/app/actions/money'
import { CopyButton } from '@/components/CopyButton'
import { Submit } from '@/components/Submit'
import { all } from '@/lib/data'
import { attendanceOf, average, byName, fDay, feeOf, fMonth, fTime, level, money, pct, thisMonth, wa } from '@/lib/util'

export default async function Reports({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { sb } = await need(isAdmin)
  const { s: asked } = await searchParams
  const month = thisMonth()
  const [{ data: groups }, students, { data: notices }] = await Promise.all([
    sb.from('groups').select('id, name, monthly_fee, archived_at, teacher:profiles!groups_teacher_id_fkey(full_name)').order('created_at'),
    all((a, b) => sb.from('profiles').select('id, full_name, parent_phone, enrollments(group_id, special_fees(monthly_fee))', { count: 'exact' }).eq('role', 'student').order('id').range(a, b)),
    sb.from('notices').select('id, group_id, body, created_at').order('created_at', { ascending: false }).limit(20),
  ])
  const live = (groups ?? []).filter((g) => !g.archived_at)
  const group = new Map(live.map((g) => [g.id, g]))
  // only what the student is in now, in groups that are running
  const ss = students.map((x) => ({ ...x, enrollments: x.enrollments.filter((e) => group.has(e.group_id)) })).sort(byName)
  const s = ss.find((x) => x.id === asked) ?? ss[0]

  let report = ''
  if (s) {
    const [{ data: att }, { data: work }, { data: paid }] = await Promise.all([
      sb.from('attendance').select('day, status, group_id').eq('student_id', s.id).order('day', { ascending: false }),
      sb.from('submissions').select('created_at, assignment:assignments(title, group_id), grades(correct, wrong, note)').eq('student_id', s.id).eq('status', 'reviewed').order('created_at'),
      sb.from('payments').select('group_id').eq('student_id', s.id).eq('month', month),
    ])
    const many = s.enrollments.length > 1
    const part = (gid: string, fee: number) => {
      const g = group.get(gid)!
      const rows = (att ?? []).filter((r) => r.group_id === gid)
      const a = attendanceOf(rows)
      const graded = (work ?? []).flatMap((w) => (w.grades && w.assignment.group_id === gid ? [{ ...w.grades, title: w.assignment.title }] : []))
      const av = average(graded.map((x) => pct(x.correct, x.wrong)))
      const last = graded[graded.length - 1]
      const lastAbsent = rows.find((r) => r.status === 'absent')
      return [
        `${many ? '◂ ' : 'المجموعة: '}${g.name}${g.teacher ? ' — ' + g.teacher.full_name : ''}`,
        `الحضور: حضر ${a.present + a.late} من ${a.total} حصة (غاب ${a.absent}، اتأخر ${a.late})`,
        lastAbsent ? `آخر غياب: ${fDay(lastAbsent.day)}` : '',
        `الدرجات: متوسط ${av == null ? '—' : av + '%'} — المستوى: ${level(av)[0]}`,
        last ? `آخر واجب: ${last.title} — ${last.correct} من ${last.correct + last.wrong}` : '',
        last?.note ? `ملاحظة المدرس: ${last.note}` : '',
        `اشتراك ${fMonth(month)}: ${paid?.some((p) => p.group_id === gid) ? 'مدفوع' : 'لسه مدفعش (' + money(fee) + ')'}`,
      ].filter(Boolean)
    }
    report = [
      `تقرير الطالب: ${s.full_name}`,
      ...(s.enrollments.length ? s.enrollments.flatMap((e, i) => [...(many && i ? [''] : []), ...part(e.group_id, feeOf(group.get(e.group_id)!, e.special_fees))]) : ['مش متسجل في مجموعة دلوقتي.']),
      ...(many ? [''] : []),
      'مع تحيات إدارة السنتر',
    ].join('\n')
  }
  const names = (x: (typeof ss)[number]) => x.enrollments.map((e) => group.get(e.group_id)!.name).join('، ')

  return (
    <>
      <h1 className="h">التقارير والإشعارات</h1>
      <section className="panel">
        <h2>تقرير طالب لولي الأمر</h2>
        {s ? (
          <>
            <form method="get" className="actions">
              <label className="fld inline">
                <span>الطالب</span>
                <select id="s" name="s" defaultValue={s.id} key={s.id}>
                  {ss.map((x) => <option key={x.id} value={x.id}>{x.full_name}{x.enrollments.length ? ' — ' + names(x) : ''}</option>)}
                </select>
              </label>
              <button className="btn sm ghost2">اعرض التقرير</button>
            </form>
            <pre className="report">{report}</pre>
            <div className="actions">
              {s.parent_phone ? (
                <a className="btn" href={wa(s.parent_phone, report)} target="_blank" rel="noopener">ابعته واتساب لولي الأمر</a>
              ) : (
                <span className="muted small">مفيش رقم ولي أمر متسجل للطالب ده.</span>
              )}
              <CopyButton text={report} label="انسخ التقرير" />
            </div>
          </>
        ) : (
          <p className="muted">لسه مفيش طلاب.</p>
        )}
      </section>

      <section className="panel">
        <h2>إشعار للطلاب وأولياء الأمور</h2>
        <form action={addNotice} className="form">
          <label className="fld">
            <span>لمين</span>
            <select id="n-group" name="group">
              <option value="all">كل المجموعات</option>
              {live.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="fld"><span>الرسالة</span><textarea id="n-body" name="body" rows={3} maxLength={1000} required placeholder="مثلاً: حصة السبت اتأجلت للأحد الساعة 4" /></label>
          <p className="muted small">الطلاب بيشوفوا الإشعار أول ما يفتحوا المنصة. أولياء الأمور بتبعتهولهم واتساب من القائمة اللي تحت.</p>
          <div><Submit>جهّز الإشعار</Submit></div>
        </form>
      </section>

      {!!notices?.length && (
        <section className="panel">
          <h2>إشعارات اتجهزت</h2>
          <ul className="list">
            {notices.map((n) => {
              const to = ss.filter((x) => x.parent_phone && (!n.group_id || x.enrollments.some((e) => e.group_id === n.group_id)))
              return (
                <li key={n.id}>
                  <div>
                    <b>{n.group_id ? (groups?.find((g) => g.id === n.group_id)?.name ?? '') : 'كل المجموعات'}</b> <span className="muted small">{fTime(n.created_at)}</span>
                    <p>{n.body}</p>
                    <details>
                      <summary className="link small">ابعتها لأولياء الأمور واحد واحد ({to.length})</summary>
                      <div className="walist">
                        {to.map((x) => <a key={x.id} href={wa(x.parent_phone!, n.body)} target="_blank" rel="noopener">{x.full_name}</a>)}
                      </div>
                    </details>
                  </div>
                  <form action={deleteNotice}>
                    <input type="hidden" name="id" value={n.id} />
                    <Submit className="link small">امسحه</Submit>
                  </form>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
