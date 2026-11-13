'use client'
import { useFormStatus } from 'react-dom'

/** A submit button that says it is working, so nobody taps twice on a slow connection. */
export function Submit({ children, className = 'btn' }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button className={className} disabled={pending}>
      {pending ? 'لحظة…' : children}
    </button>
  )
}
