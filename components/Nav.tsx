'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Nav({ items }: { items: { href: string; label: string; count?: number }[] }) {
  const path = usePathname()
  return (
    <nav className="wrap tabs" aria-label="الأقسام">
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
