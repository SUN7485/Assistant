'use client'
import { useState } from 'react'

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn ghost2"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setDone(true),
          () => setDone(false),
        )
      }
    >
      {done ? 'اتنسخ' : label}
    </button>
  )
}
