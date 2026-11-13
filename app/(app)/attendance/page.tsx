import Link from 'next/link'
import { can, need } from '@/lib/me'
import { saveAttendance } from '../../actions'
import { Submit } from '@/components/Submit'
import { fDay, isDay, today } from '@/lib/util'

const CHOICES = [['present', 'حاضر'], ['late', 'متأخر'], ['absent', 'غايب']] as const

export default async function Attendance({ searchParams }: { searchParams: Promise<{ g?: string; d?: string }> }) {
  const { sb } = await need((me) => can(me, 'attendance'))
  const { g: asked, d } = await searchParams
  const { data: groups } = await sb.from('groups').select('id, name').order('created_at')
  const g = groups?.find((x) => x.id === asked) ?? groups?.[0]
  if (!g) return (<><h1 className="h">الحضور والغياب</h1><p className="empty">مفيش مجموعات لسه.</p></>)
  const day = d && isDay(d) && d <= today() ? d : today()
  const [{ data: students }, { data: taken }] = await Promise.all([
    sb.from('profiles').select('id, full_name').eq('group_id', g.id).eq('role', 'student').order('full_name'),
    sb.from('attendance').select('student_id, status').eq('group_id', g.id).eq('day', day),
  ])
  const was = new Map((taken ?? []).map((r) => [r.student_id, r.status]))

  return (
    <>
      <h1 className="h">الحضور والغياب</h1>
      {(groups?.length ?? 0) > 1 && (
        <div className="chips">
          {groups!.map((x) => (
            <Link key={x.id} href={`/attendance?g=${x.id}&d=${day}`} className={'chipbtn' + (x.id === g.id ? ' on' : '')}>{x.name}</Link>
          ))}
        </div>
      )}
      <form className="row" method="get">
        <input type="hidden" name="g" value={g.id} />
        <label className="fld inline"><span>يوم الحصة</span><input type="date" id="d" name="d" defaultValue={day} max={today()} /></label>
        <button className="btn sm ghost2">افتح اليوم ده</button>
      </form>
      <form action={saveAttendance} className="panel" key={g.id + day}>
        <input type="hidden" name="group" value={g.id} />
        <input type="hidden" name="day" value={day} />
        <div className="row">
          <h2>{fDay(day)}</h2>
          <span className="muted small">{taken?.length ? 'الحصة دي متسجلة، وأي تعديل هيتحفظ عليها.' : 'الكل متعلّم حاضر. غيّر الغايب والمتأخر بس.'}</span>
        </div>
        {students?.length ? (
          <ul className="list roll">
            {students.map((s) => (
              <li key={s.id}>
                <b>{s.full_name}</b>
                <div className="seg" role="radiogroup" aria-label={s.full_name}>
                  {CHOICES.map(([v, label]) => (
                    <label className={'segb ' + v} key={v}>
                      <input type="radio" name={'s_' + s.id} value={v} defaultChecked={(was.get(s.id) ?? 'present') === v} />
                      {label}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">المجموعة دي مفيهاش طلاب لسه.</p>
        )}
        {!!students?.length && <div><Submit>حفظ الحضور</Submit></div>}
      </form>
    </>
  )
}
