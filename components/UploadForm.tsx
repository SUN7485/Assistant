'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { submitSolution } from '@/app/actions/daily'
import { MAX_PAGES, pagesLabel } from '@/lib/pages'

type Item = { id: string; title: string; state: 'none' | 'new' | 'reviewed' }
/** A page the teacher already has: where it is stored, and a link to show it. */
export type SentPage = { path: string; url: string }
/** One page of the solution. `blob` is a photo taken now; `path` is set once it is in storage. */
type Page = { key: string; url: string; blob?: Blob; path?: string }

/** Shrinks a phone photo to at most 1600px on its long side, as JPEG, so it uploads fast on mobile data. */
async function shrink(file: File): Promise<Blob> {
  let img: ImageBitmap | HTMLImageElement
  try {
    // 'from-image' turns the photo the way the phone was held
    img = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // some phones cannot decode their own format this way; an <img> can
    const url = URL.createObjectURL(file)
    try {
      img = new Image()
      img.src = url
      await img.decode()
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const k = Math.min(1, 1600 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  const g = c.getContext('2d')!
  g.fillStyle = '#fff' // a see-through picture would turn black as JPEG
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(img, 0, 0, c.width, c.height)
  if ('close' in img) img.close()
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('toBlob'))), 'image/jpeg', 0.75))
}

const fromSent = (sent: SentPage[] = []): Page[] => sent.map((s) => ({ key: s.path, url: s.url, path: s.path }))

export function UploadForm({ uid, items, sent }: { uid: string; items: Item[]; sent: Record<string, SentPage[]> }) {
  const open = items.filter((i) => i.state !== 'reviewed')
  const first = open.find((i) => i.state === 'none')?.id ?? open[0]?.id ?? ''
  const [aid, setAid] = useState(first)
  const [pages, setPages] = useState<Page[]>(() => fromSent(sent[first]))
  const [at, setAt] = useState(0) // the page shown large
  const [busy, setBusy] = useState<'' | 'prep' | 'send'>('')
  const [step, setStep] = useState('') // while sending: which page is going
  const [arrived, setArrived] = useState(false)
  const [err, setErr] = useState('')
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const made = useRef(new Set<string>()) // preview links to free when the form goes away
  const router = useRouter()

  useEffect(() => {
    const urls = made.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  if (!open.length) return <p className="muted">مفيش واجبات مستنية حل دلوقتي. الأستاذ بيضيف الواجب بعد الحصة.</p>

  const already = sent[aid] ?? []
  const changed = pages.length !== already.length || pages.some((p, i) => p.path !== already[i].path)
  const idx = Math.min(at, pages.length - 1)
  const cur = pages[idx]
  const full = pages.length >= MAX_PAGES

  // Another homework: show what was sent for it, and keep photos taken just now.
  function choose(id: string) {
    setAid(id)
    setErr('')
    setArrived(false)
    const fresh = pages.filter((p) => p.blob)
    setPages([...fromSent(sent[id]), ...fresh])
    setAt(fresh.length ? (sent[id]?.length ?? 0) : 0)
  }

  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    const room = MAX_PAGES - pages.length
    setErr(files.length > room ? `أقصى عدد ${pagesLabel(MAX_PAGES)} للحل الواحد. اتضاف أول ${pagesLabel(room)} بس.` : '')
    setBusy('prep')
    const next: Page[] = []
    let bad = 0
    for (const f of files.slice(0, room)) {
      try {
        const blob = await shrink(f)
        const url = URL.createObjectURL(blob)
        made.current.add(url)
        next.push({ key: url, url, blob })
      } catch {
        bad++
      }
    }
    setBusy('')
    if (bad) setErr(bad === files.length ? 'الصورة مفتحتش. جرّب تصوّر تاني.' : `${pagesLabel(bad)} مفتحتش. جرّب تصوّرها تاني.`)
    if (!next.length) return
    setAt(pages.length + next.length - 1)
    setPages([...pages, ...next])
    setArrived(false)
  }

  function remove(i: number) {
    setPages(pages.filter((_, j) => j !== i))
    setAt(Math.max(0, Math.min(i, pages.length - 2)))
    setErr('')
    setArrived(false)
  }

  function move(i: number, by: -1 | 1) {
    const j = i + by
    if (j < 0 || j >= pages.length) return
    const next = [...pages]
    ;[next[i], next[j]] = [next[j], next[i]]
    setPages(next)
    setAt(j)
  }

  async function send() {
    if (!pages.length || !aid || busy) return
    setErr('')
    setBusy('send')
    const prefix = `${uid}/${aid}-`
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const stamp = Date.now()
    const done = [...pages]
    const many = done.length > 1
    let problem: string | null = null
    try {
      for (let i = 0; i < done.length && !problem; i++) {
        const p = done[i]
        if (!p.blob || p.path?.startsWith(prefix)) continue // already in storage: sent before, or by a try that stopped halfway
        setStep(many ? `بتتبعت صفحة ${i + 1} من ${done.length}…` : 'بيتبعت…')
        const path = `${prefix}${stamp}-${i + 1}.jpg`
        const { error } = await sb.storage.from('solutions').upload(path, p.blob, { contentType: 'image/jpeg' })
        if (error) problem = many ? `صفحة ${i + 1} موصلتش. اتأكد من النت ودوس ابعت تاني، واللي وصل مش هيتبعت من الأول.` : 'الصورة موصلتش. اتأكد من النت وجرّب تاني.'
        else done[i] = { ...p, path }
      }
      setPages(done)
      if (!problem) {
        setStep('بيتبعت…')
        problem = await submitSolution(aid, done.map((p) => p.path!))
      }
    } catch {
      problem = 'الحل متبعتش. اتأكد من النت وجرّب تاني.'
    }
    setBusy('')
    if (problem) return setErr(problem)
    setArrived(true)
    // The page reloads with what the teacher now has, and the form starts again on the next homework.
    router.push('/upload?msg=' + encodeURIComponent(many ? `الحل وصل للأستاذ — ${pagesLabel(done.length)}` : 'الحل وصل للأستاذ') + '&at=' + Date.now())
    router.refresh()
  }

  return (
    <div className="form">
      <label className="fld">
        <span>الواجب</span>
        <select id="assignment" value={aid} onChange={(e) => choose(e.target.value)} disabled={!!busy}>
          {open.map((i) => (
            <option key={i.id} value={i.id}>{i.title}{i.state === 'new' ? ' — اتبعت' : ''}</option>
          ))}
        </select>
      </label>

      {cur ? (
        <>
          {already.length > 0 && (
            <p className="muted small">
              {changed ? 'لما تدوس ابعت، الأستاذ هيشوف الصفحات دي بدل اللي اتبعتت قبل كده.' : 'ده اللي وصل للأستاذ. لو نسيت صفحة ضيفها وابعت تاني.'}
            </p>
          )}
          <figure className="photo">
            <img src={cur.url} alt={`صفحة ${idx + 1} من الحل`} />
          </figure>
          <div className="row">
            <b id="page-count">صفحة {idx + 1} من {pages.length}</b>
            <div className="actions">
              {pages.length > 1 && (
                <>
                  <button type="button" className="btn sm ghost2" onClick={() => move(idx, -1)} disabled={!!busy || idx === 0}>قدّمها</button>
                  <button type="button" className="btn sm ghost2" onClick={() => move(idx, 1)} disabled={!!busy || idx >= pages.length - 1}>أخّرها</button>
                </>
              )}
              <button type="button" className="btn sm ghost2 danger" onClick={() => remove(idx)} disabled={!!busy}>امسح الصفحة</button>
            </div>
          </div>
          {pages.length > 1 && (
            <div className="thumbs" role="group" aria-label="صفحات الحل">
              {pages.map((p, i) => (
                <button type="button" key={p.key} className={'thumb' + (p === cur ? ' on' : '')} onClick={() => setAt(i)} aria-label={`صفحة ${i + 1}`} aria-pressed={p === cur}>
                  <img src={p.url} alt="" />
                  <span>{i + 1}</span>
                </button>
              ))}
            </div>
          )}
          <div className="actions">
            <button type="button" className="btn ghost2" onClick={() => camera.current?.click()} disabled={!!busy || full}>صوّر صفحة كمان</button>
            <button type="button" className="link" onClick={() => gallery.current?.click()} disabled={!!busy || full}>أو اختار من الصور</button>
          </div>
          {full && <p className="muted small">وصلت لأقصى عدد: {pagesLabel(MAX_PAGES)}.</p>}
          {busy === 'prep' && <p className="muted small" role="status">الصور بتتجهز…</p>}
          {arrived ? (
            <p className="chip ok" role="status">الحل وصل للأستاذ</p>
          ) : changed && (
            <button type="button" className="btn big" onClick={send} disabled={!!busy}>
              {busy === 'send' ? step : pages.length > 1 ? `ابعت الحل للأستاذ (${pagesLabel(pages.length)})` : 'ابعت الحل للأستاذ'}
            </button>
          )}
        </>
      ) : (
        <>
          <button type="button" className="shoot" onClick={() => camera.current?.click()} disabled={!!busy}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.6l1.4-2h7l1.4 2h2.6A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
              <circle cx="12" cy="13" r="3.6" />
            </svg>
            <b>{busy === 'prep' ? 'الصور بتتجهز…' : 'افتح الكاميرا'}</b>
            <span className="muted">صوّر الورقة كلها في نور كويس. لو الحل أكتر من صفحة، صوّر كل صفحة لوحدها.</span>
          </button>
          <button type="button" className="link center" onClick={() => gallery.current?.click()} disabled={!!busy}>أو اختار صور من الموبايل</button>
          {already.length > 0 && <p className="muted small">مسحت كل الصفحات. اللي وصل للأستاذ قبل كده لسه عنده لحد ما تبعت صفحات جديدة.</p>}
        </>
      )}

      <input ref={camera} id="shot" type="file" accept="image/*" capture="environment" onChange={add} hidden />
      <input ref={gallery} id="pick" type="file" accept="image/*" multiple onChange={add} hidden />
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  )
}
