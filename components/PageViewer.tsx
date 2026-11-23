'use client'
import { useRef, useState } from 'react'

/** The pages of one solution, one at a time: swipe on a phone, arrows or thumbnails otherwise. Tap a page to open it full size. */
export function PageViewer({ pages, name }: { pages: string[]; name: string }) {
  const strip = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const n = pages.length

  function go(i: number) {
    const el = strip.current?.children[Math.max(0, Math.min(n - 1, i))]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }
  // Which page is in view. Right-to-left scrolling counts down from zero, hence abs.
  function seen() {
    const el = strip.current
    if (el) setAt(Math.max(0, Math.min(n - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth))))
  }
  // Left is forward when reading right to left.
  function keys(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') go(at + 1)
    else if (e.key === 'ArrowRight') go(at - 1)
    else return
    e.preventDefault()
  }

  if (!n) return <figure className="photo"><p className="muted">الصورة مش موجودة.</p></figure>

  return (
    <div className="viewer">
      <div className="pager" ref={strip} onScroll={seen} onKeyDown={keys} tabIndex={n > 1 ? 0 : undefined} role="group" aria-label={`صفحات حل ${name}`}>
        {pages.map((src, i) => (
          <a className="photo" key={src} href={src} target="_blank" rel="noreferrer" title="افتحها بالحجم الكامل">
            <img src={src} alt={n > 1 ? `حل ${name} — صفحة ${i + 1} من ${n}` : `صورة حل ${name}`} loading={i ? 'lazy' : undefined} />
          </a>
        ))}
      </div>
      {n > 1 && (
        <>
          <div className="row">
            <button type="button" className="btn sm ghost2" onClick={() => go(at - 1)} disabled={at === 0}>→ اللي قبلها</button>
            <b id="viewer-count">صفحة {at + 1} من {n}</b>
            <button type="button" className="btn sm ghost2" onClick={() => go(at + 1)} disabled={at === n - 1}>اللي بعدها ←</button>
          </div>
          <div className="thumbs" role="group" aria-label="كل الصفحات">
            {pages.map((src, i) => (
              <button type="button" key={src} className={'thumb' + (i === at ? ' on' : '')} onClick={() => go(i)} aria-label={`صفحة ${i + 1}`} aria-pressed={i === at}>
                <img src={src} alt="" loading="lazy" />
                <span>{i + 1}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
