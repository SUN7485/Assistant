'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { submitSolution } from '@/app/actions'

type Item = { id: string; title: string; state: 'none' | 'new' | 'reviewed' }

/** Shrinks a phone photo to at most 1600px on its long side, as JPEG, so it uploads fast on mobile data. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file)
  const k = Math.min(1, 1600 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('toBlob'))), 'image/jpeg', 0.75))
}

export function UploadForm({ uid, items }: { uid: string; items: Item[] }) {
  const open = items.filter((i) => i.state !== 'reviewed')
  const [aid, setAid] = useState(open.find((i) => i.state === 'none')?.id ?? open[0]?.id ?? '')
  const [shot, setShot] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const router = useRouter()

  if (!open.length) return <p className="muted">مفيش واجبات مستنية حل دلوقتي. الأستاذ بيضيف الواجب بعد الحصة.</p>

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setErr('')
    try {
      const b = await shrink(f)
      setShot(b)
      setPreview(URL.createObjectURL(b))
    } catch {
      setErr('الصورة مفتحتش. جرّب تصوّر تاني.')
    }
  }

  async function send() {
    if (!shot || !aid) return
    setBusy(true)
    setErr('')
    const path = `${uid}/${aid}-${Date.now()}.jpg`
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await sb.storage.from('solutions').upload(path, shot, { contentType: 'image/jpeg' })
    const problem = error ? 'الصورة موصلتش. اتأكد من النت وجرّب تاني.' : await submitSolution(aid, path)
    setBusy(false)
    if (problem) return setErr(problem)
    setShot(null)
    setPreview('')
    router.push('/upload?msg=' + encodeURIComponent('الحل وصل للأستاذ') + '&at=' + Date.now())
    router.refresh()
  }

  return (
    <div className="form">
      <label className="fld">
        <span>الواجب</span>
        <select id="assignment" value={aid} onChange={(e) => setAid(e.target.value)}>
          {open.map((i) => (
            <option key={i.id} value={i.id}>{i.title}{i.state === 'new' ? ' — اتبعت (لو بعته تاني هيتبدل)' : ''}</option>
          ))}
        </select>
      </label>
      {preview ? (
        <>
          <figure className="photo">
            <img src={preview} alt="صورة الحل قبل ما تتبعت" />
          </figure>
          <div className="actions">
            <button className="btn" onClick={send} disabled={busy}>{busy ? 'بيتبعت…' : 'ابعت الحل للأستاذ'}</button>
            <label className="btn ghost2" htmlFor="shot">صوّر تاني</label>
          </div>
        </>
      ) : (
        <label className="shoot" htmlFor="shot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.6l1.4-2h7l1.4 2h2.6A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
            <circle cx="12" cy="13" r="3.6" />
          </svg>
          <b>افتح الكاميرا</b>
          <span className="muted">صوّر الورقة كلها في نور كويس</span>
        </label>
      )}
      <input id="shot" type="file" accept="image/*" capture="environment" onChange={pick} hidden />
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  )
}
