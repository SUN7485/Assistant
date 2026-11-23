import { need, isStudent } from '@/lib/me'
import { UploadForm, type SentPage } from '@/components/UploadForm'
import { pagesLabel } from '@/lib/pages'
import { daysAgo, dayOf, fTime } from '@/lib/util'

export default async function Upload() {
  const { sb, me } = await need(isStudent)
  const [{ data: work }, { data: mine }, { data: notices }] = await Promise.all([
    sb.from('assignments').select('id, title, group:groups(id, name, archived_at)').order('created_at', { ascending: false }),
    sb.from('submissions').select('assignment_id, status, created_at, photo_paths').order('created_at', { ascending: false }),
    sb.from('notices').select('id, body, created_at').order('created_at', { ascending: false }).limit(3),
  ])
  const state = new Map((mine ?? []).map((m) => [m.assignment_id, m.status as 'new' | 'reviewed']))
  const groups = new Set((work ?? []).map((w) => w.group.id))
  // With more than one group, say which group each homework is for.
  const label = (w: NonNullable<typeof work>[number]) => (groups.size > 1 ? `${w.title} — ${w.group.name}` : w.title)
  const title = new Map((work ?? []).map((w) => [w.id, label(w)]))
  const items = (work ?? []).filter((w) => !w.group.archived_at).map((w) => ({ id: w.id, title: label(w), state: state.get(w.id) ?? ('none' as const) }))
  const waiting = items.filter((i) => i.state === 'none').length
  const fresh = (notices ?? []).filter((n) => dayOf(n.created_at) >= daysAgo(14))

  // What the teacher has for each solution not reviewed yet, so the student can check it and add a forgotten page.
  const pending = (mine ?? []).filter((m) => m.status === 'new')
  const paths = pending.flatMap((m) => m.photo_paths)
  const { data: urls } = paths.length ? await sb.storage.from('solutions').createSignedUrls(paths, 3600) : { data: [] }
  const url = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]))
  const sent: Record<string, SentPage[]> = {}
  for (const m of pending) sent[m.assignment_id] = m.photo_paths.map((path) => ({ path, url: url.get(path) ?? '' }))

  return (
    <>
      <h1 className="h">أهلاً {me.full_name.split(' ')[0]}</h1>
      {fresh.length > 0 && (
        <section className="panel notice" id="notices">
          <h2>من إدارة السنتر</h2>
          <ul className="list">
            {fresh.map((n) => <li key={n.id}><div><p>{n.body}</p><div className="muted small">{fTime(n.created_at)}</div></div></li>)}
          </ul>
        </section>
      )}
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
                <div><b>{title.get(m.assignment_id) ?? 'واجب اتمسح'}</b><div className="muted small">{fTime(m.created_at)} · {pagesLabel(m.photo_paths.length)}</div></div>
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
