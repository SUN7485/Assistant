import { need, isStudent } from '@/lib/me'
import { UploadForm } from '@/components/UploadForm'
import { fTime } from '@/lib/util'

export default async function Upload() {
  const { sb, me } = await need(isStudent)
  const [{ data: work }, { data: mine }] = await Promise.all([
    sb.from('assignments').select('id, title').order('created_at', { ascending: false }),
    sb.from('submissions').select('assignment_id, status, created_at').order('created_at', { ascending: false }),
  ])
  const state = new Map((mine ?? []).map((m) => [m.assignment_id, m.status as 'new' | 'reviewed']))
  const title = new Map((work ?? []).map((w) => [w.id, w.title]))
  const items = (work ?? []).map((w) => ({ id: w.id, title: w.title, state: state.get(w.id) ?? ('none' as const) }))

  return (
    <>
      <h1 className="h">أهلاً {me.full_name.split(' ')[0]}</h1>
      <section className="panel">
        <h2>صوّر حل الواجب وابعته</h2>
        <UploadForm uid={me.id} items={items} />
      </section>
      <section className="panel">
        <h2>حلولي اللي بعتها</h2>
        {mine?.length ? (
          <ul className="list">
            {mine.map((m) => (
              <li key={m.assignment_id}>
                <div><b>{title.get(m.assignment_id)}</b><div className="muted small">{fTime(m.created_at)}</div></div>
                {m.status === 'reviewed' ? <span className="chip ok">الأستاذ راجعه</span> : <span className="chip">وصل للأستاذ</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">لسه مبعتش حلول. صوّر أول واحد من فوق.</p>
        )}
      </section>
    </>
  )
}
