'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Nav({ items }: { items: { href: string; label: string; count?: number }[] }) {
  const path = usePathname()
  const strip = useRef<HTMLElement>(null)
  // On a phone the strip scrolls sideways: keep the tab you are on in view.
  useEffect(() => {
    const el = strip.current, on = el?.querySelector<HTMLElement>('.on')
    if (!el || !on) return
    const a = el.getBoundingClientRect(), b = on.getBoundingClientRect()
    if (b.left < a.left || b.right > a.right) el.scrollBy({ left: b.left - a.left - (a.width - b.width) / 2 })
  }, [path])
  return (
    <nav className="wrap tabs" aria-label="الأقسام" ref={strip}>
      {items.map((i) => {
        const on = path === i.href || path.startsWith(i.href + '/')
        return (
          <Link key={i.href} href={i.href} className={'tab' + (on ? ' on' : '')} aria-current={on ? 'page' : undefined}>
            {i.label}
            {i.count ? <span className="cnt">{i.count}</span> : null}
          </Link>
        )
      })}
    </nav>
  )
}
