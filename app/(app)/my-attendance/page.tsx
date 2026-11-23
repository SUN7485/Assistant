import { need, isStudent } from '@/lib/me'
import { Stat } from '@/components/Stat'
import { ATT, attendanceOf, fDay } from '@/lib/util'

export default async function MyAttendance() {
  const { sb } = await need(isStudent)
  const { data } = await sb.from('attendance').select('day, status, group:groups(id, name)').order('day', { ascending: false })
  const rows = data ?? []
  const a = attendanceOf(rows)
  const many = new Set(rows.map((r) => r.group.id)).size > 1
  return (
    <>
      <h1 className="h">حضوري</h1>
      <div className="stats">
        <Stat v={a.present} l="حضرت" s="حصة في معادها" />
        <Stat v={a.late} l="اتأخرت" s="حصة" />
        <Stat v={a.absent} l="غبت" s="حصة" />
      </div>
      <section className="panel">
        <h2>كل الحصص</h2>
        {rows.length ? (
          <ul className="list">
            {rows.map((r) => (
              <li key={r.group.id + r.day}>
                <span>{fDay(r.day)}{many && <span className="muted small"> · {r.group.name}</span>}</span>
                <span className={'chip ' + ATT[r.status][1]}>{ATT[r.status][0]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">لسه مفيش حصص متسجلة.</p>
        )}
      </section>
    </>
  )
}
