'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/** Shows ?msg= or ?err= from the last action as a toast. Each action adds its own ?at=, so the same message twice still shows twice. */
export function Flash() {
  const q = useSearchParams()
  const err = q.get('err')
  const text = err || q.get('msg')
  const key = q.toString()
  const [gone, setGone] = useState('')
  useEffect(() => {
    if (!text) return
    const t = setTimeout(() => setGone(key), err ? 6000 : 3500)
    return () => clearTimeout(t)
  }, [key, text, err])
  if (!text || gone === key) return null
  return (
    <div id="toast" role="status" className={err ? 'err' : ''}>
      {text}
    </div>
  )
}
