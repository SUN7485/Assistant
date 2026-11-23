import { need, isStudent } from '@/lib/me'
import { UploadForm, type SentPage } from '@/components/UploadForm'
import { pagesLabel } from '@/lib/pages'
import { fTime } from '@/lib/util'

export default async function Upload() {
  const { sb, me } = await need(isStudent)
  const [{ data: work }, { data: mine }] = await Promise.all([
    sb.from('assignments').select('id, title').order('created_at', { ascending: false }),
    sb.from('submissions').select('assignment_id, status, created_at, photo_paths').order('created_at', { ascending: false }),
  ])
  const state = new Map((mine ?? []).map((m) => [m.assignment_id, m.status as 'new' | 'reviewed']))
  const title = new Map((work ?? []).map((w) => [w.id, w.title]))
  const items = (work ?? []).map((w) => ({ id: w.id, title: w.title, state: state.get(w.id) ?? ('none' as const) }))
  const waiting = items.filter((i) => i.state === 'none').length

  // What the teacher has for each solution not reviewed yet, so the student can check it and add a forgotten page.
  const pending = (mine ?? []).filter((m) => m.status === 'new')
  const paths = pending.flatMap((m) => m.photo_paths as string[])
  const { data: urls } = paths.length ? await sb.storage.from('solutions').createSignedUrls(paths, 3600) : { data: [] }
  const url = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]))
  const sent: Record<string, SentPage[]> = {}
  for (const m of pending) sent[m.assignment_id] = (m.photo_paths as string[]).map((path) => ({ path, url: url.get(path) ?? '' }))

  return (
    <>
      <h1 className="h">أهلاً {me.full_name.split(' ')[0]}</h1>
      <section className="panel">
        <div>
          <h2>صوّر حل الواجب وابعته</h2>
          {waiting > 0 && <p className="muted small">{waiting === 1 ? 'عندك واجب واحد لسه مبعتش حله.' : waiting === 2 ? 'عندك واجبين لسه مبعتش حلهم.' : `عندك ${waiting} واجبات لسه مبعتش حلها.`}</p>}
        </div>
        {/* a new key after each send, so the form starts again from what the teacher now has */}
        <UploadForm key={mine?.[0]?.created_at ?? 'first'} uid={me.id} items={items} sent={sent} />
      </section>
      <section className="panel">
        <h2>حلولي اللي بعتها</h2>
        {mine?.length ? (
          <ul className="list">
            {mine.map((m) => (
              <li key={m.assignment_id}>
                <div><b>{title.get(m.assignment_id)}</b><div className="muted small">{fTime(m.created_at)} · {pagesLabel((m.photo_paths as string[]).length)}</div></div>
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
