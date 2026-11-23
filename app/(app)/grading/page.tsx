import Link from 'next/link'
import { can, need } from '@/lib/me'
import { pagesLabel } from '@/lib/pages'
import { fTime, pct } from '@/lib/util'

type Row = {
  id: string; status: string; created_at: string; photo_paths: string[]
  student: { full_name: string } | null
  assignment: { title: string; group: { name: string } | null } | null
  grades: { correct: number; wrong: number } | null
}

export default async function Grading({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { sb, me } = await need((me) => can(me, 'grade'))
  const tab = (await searchParams).tab === 'reviewed' ? 'reviewed' : 'new'
  const [{ data }, { count: nNew }, { count: nDone }] = await Promise.all([
    sb.from('submissions')
      .select('id, status, created_at, photo_paths, student:profiles(full_name), assignment:assignments(title, group:groups(name)), grades(correct, wrong)')
      .eq('status', tab)
      .order('created_at', { ascending: tab === 'new' })
      .limit(100),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'reviewed'),
  ])
  const rows = (data ?? []) as unknown as Row[]
  const { data: urls } = rows.length
    ? await sb.storage.from('solutions').createSignedUrls(rows.map((r) => r.photo_paths[0]), 3600) // the first page stands for the solution
    : { data: [] }
  const url = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]))

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
                <img src={url.get(x.photo_paths[0]) ?? ''} alt={'حل ' + x.student?.full_name} loading="lazy" />
                {x.photo_paths.length > 1 && <span>{pagesLabel(x.photo_paths.length)}</span>}
              </span>
              <div>
                <b>{x.student?.full_name}</b>
                <span className="muted small">{x.assignment?.title} · {x.assignment?.group?.name}</span>
                <span className="muted small">{fTime(x.created_at)}</span>
                {x.grades && (
                  <span className="score">
                    <span className="ok">✓ {x.grades.correct}</span><span className="bad">✗ {x.grades.wrong}</span><b>{pct(x.grades.correct, x.grades.wrong)}%</b>
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="empty">{tab === 'new' ? 'مفيش حلول جديدة. أول ما طالب يصوّر حله ويبعته هيظهر هنا.' : 'لسه مفيش حلول اتصححت.'}</p>
      )}
    </>
  )
}
