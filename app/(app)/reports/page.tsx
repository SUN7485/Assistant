import { need, isAdmin } from '@/lib/me'
import { addNotice } from '../../actions'
import { CopyButton } from '@/components/CopyButton'
import { Submit } from '@/components/Submit'
import { attendanceOf, average, fDay, fMonth, fTime, level, money, pct, thisMonth, wa } from '@/lib/util'

export default async function Reports({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { sb } = await need(isAdmin)
  const { s: asked } = await searchParams
  const month = thisMonth()
  const [{ data: groups }, { data: students }, { data: notices }] = await Promise.all([
    sb.from('groups').select('id, name, teacher:profiles!groups_teacher_id_fkey(full_name)').order('created_at'),
    sb.from('profiles').select('id, full_name, group_id, parent_phone, monthly_fee').eq('role', 'student').order('full_name'),
    sb.from('notices').select('id, group_id, body, created_at').order('created_at', { ascending: false }).limit(20),
  ])
  const ss = students ?? []
  const s = ss.find((x) => x.id === asked) ?? ss[0]
  const groupName = (id: string | null) => groups?.find((g) => g.id === id)?.name ?? ''

  let report = ''
  if (s) {
    const [{ data: att }, { data: work }, { data: paid }] = await Promise.all([
      sb.from('attendance').select('day, status').eq('student_id', s.id).order('day', { ascending: false }),
      sb.from('submissions').select('created_at, assignment:assignments(title), grades(correct, wrong, note)').eq('student_id', s.id).eq('status', 'reviewed').order('created_at'),
      sb.from('payments').select('amount').eq('student_id', s.id).eq('month', month).maybeSingle(),
    ])
    const a = attendanceOf(att ?? [])
    const graded = (work ?? []).flatMap((w) => {
      const g = w.grades as unknown as { correct: number; wrong: number; note: string } | null
      return g ? [{ ...g, title: (w.assignment as unknown as { title: string }).title }] : []
    })
    const av = average(graded.map((g) => pct(g.correct, g.wrong)))
    const last = graded[graded.length - 1]
    const lastAbsent = att?.find((r) => r.status === 'absent')
    const g = groups?.find((x) => x.id === s.group_id)
    report = [
      `تقرير الطالب: ${s.full_name}`,
      `المجموعة: ${g?.name ?? ''}${g?.teacher ? ' — ' + (g.teacher as unknown as { full_name: string }).full_name : ''}`,
      `الحضور: حضر ${a.present + a.late} من ${a.total} حصة (غاب ${a.absent}، اتأخر ${a.late})`,
      lastAbsent ? `آخر غياب: ${fDay(lastAbsent.day)}` : '',
      `الدرجات: متوسط ${av == null ? '—' : av + '%'} — المستوى: ${level(av)[0]}`,
      last ? `آخر واجب: ${last.title} — ${last.correct} من ${last.correct + last.wrong}` : '',
      last?.note ? `ملاحظة المدرس: ${last.note}` : '',
      `اشتراك ${fMonth(month)}: ${paid ? 'مدفوع' : 'لسه مدفعش (' + money(s.monthly_fee) + ')'}`,
      'مع تحيات إدارة السنتر',
    ].filter(Boolean).join('\n')
  }

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
                  {(groups ?? []).map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {ss.filter((x) => x.group_id === g.id).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
                    </optgroup>
                  ))}
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
        <h2>إشعار لأولياء الأمور</h2>
        <form action={addNotice} className="form">
          <label className="fld">
            <span>لمين</span>
            <select id="n-group" name="group">
              <option value="all">كل المجموعات</option>
              {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="fld"><span>الرسالة</span><textarea id="n-body" name="body" rows={3} maxLength={1000} required placeholder="مثلاً: حصة السبت اتأجلت للأحد الساعة 4" /></label>
          <div><Submit>جهّز الإشعار</Submit></div>
        </form>
      </section>

      {!!notices?.length && (
        <section className="panel">
          <h2>إشعارات اتجهزت</h2>
          <ul className="list">
            {notices.map((n) => {
              const to = ss.filter((x) => x.parent_phone && (!n.group_id || x.group_id === n.group_id))
              return (
                <li key={n.id}>
                  <div>
                    <b>{n.group_id ? groupName(n.group_id) : 'كل المجموعات'}</b> <span className="muted small">{fTime(n.created_at)}</span>
                    <p>{n.body}</p>
                    <details>
                      <summary className="link small">ابعتها لأولياء الأمور واحد واحد ({to.length})</summary>
                      <div className="walist">
                        {to.map((x) => <a key={x.id} href={wa(x.parent_phone!, n.body)} target="_blank" rel="noopener">{x.full_name}</a>)}
                      </div>
                    </details>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
