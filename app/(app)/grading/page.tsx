import Link from 'next/link'
import { can, need } from '@/lib/me'
import { pagesLabel } from '@/lib/pages'
import { fTime } from '@/lib/util'
import { Score } from '@/components/Score'

export default async function Grading({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { sb, me } = await need((me) => can(me, 'grade'))
  const tab = (await searchParams).tab === 'reviewed' ? 'reviewed' : 'new'
  const [{ data }, { count: nNew }, { count: nDone }] = await Promise.all([
    sb.from('submissions')
      .select('id, created_at, photo_paths, student:profiles(full_name), assignment:assignments(title, group:groups(name)), grades(correct, wrong, unclear, blank)')
      .eq('status', tab)
      .order('created_at', { ascending: tab === 'new' })
      .limit(100),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'reviewed'),
  ])
  const rows = data ?? []
  // the first page stands for the solution
  const { data: urls } = rows.length ? await sb.storage.from('solutions').createSignedUrls(rows.map((r) => r.photo_paths[0]), 3600) : { data: [] }
  const url = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]))
  const shownAll = tab === 'new' ? rows.length === (nNew ?? 0) : rows.length === (nDone ?? 0)

  return (
    <>
      <h1 className="h">{me.role === 'admin' ? 'التصحيح والدرجات' : 'التصحيح'}</h1>
      <div className="chips">
        <Link className={'chipbtn' + (tab === 'new' ? ' on' : '')} href="/grading">مستني تصحيح ({nNew ?? 0})</Link>
        <Link className={'chipbtn' + (tab === 'reviewed' ? ' on' : '')} href="/grading?tab=reviewed">اتصحح ({nDone ?? 0})</Link>
      </div>
      {rows.length ? (
        <div className="subs">
          {rows.map((x) => (
            <Link className="card sub" key={x.id} href={`/grading/${x.id}`}>
              <span className="cover">
                <img src={url.get(x.photo_paths[0]) ?? ''} alt={'حل ' + x.student.full_name} loading="lazy" />
                {x.photo_paths.length > 1 && <span>{pagesLabel(x.photo_paths.length)}</span>}
              </span>
              <div>
                <b>{x.student.full_name}</b>
                <span className="muted small">{x.assignment.title} · {x.assignment.group.name}</span>
                <span className="muted small">{fTime(x.created_at)}</span>
                {x.grades && (
                  <Score g={x.grades} />
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="empty">{tab === 'new' ? 'مفيش حلول جديدة. أول ما طالب يصوّر حله ويبعته هيظهر هنا.' : 'لسه مفيش حلول اتصححت.'}</p>
      )}
      {!shownAll && <p className="muted small">{tab === 'new' ? 'دي أقدم 100 حل. صحّحهم والباقي هيظهر.' : 'دي آخر 100 حل اتصححوا. الأقدم في ملف كل طالب.'}</p>}
    </>
  )
}
