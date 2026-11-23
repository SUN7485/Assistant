'use client'
import { useState } from 'react'

/** Right and wrong counts. Typing the right answers fills in the rest as wrong, until the teacher types the wrong count themself. */
export function Marks({ questions, correct, wrong }: { questions: number; correct?: number; wrong?: number }) {
  const [c, setC] = useState(correct == null ? '' : String(correct))
  const [w, setW] = useState(wrong == null ? '' : String(wrong))
  const [own, setOwn] = useState(wrong != null) // the teacher chose the wrong count; leave it alone

  function right(v: string) {
    setC(v)
    const n = Number(v)
    if (!own) setW(v !== '' && Number.isInteger(n) && n >= 0 && n <= questions ? String(questions - n) : '')
  }
  const left = c !== '' && w !== '' ? questions - Number(c) - Number(w) : null

  return (
    <>
      <div className="two">
        <label className="fld"><span>✓ صح</span><input id="correct" name="correct" type="number" inputMode="numeric" min={0} max={questions} value={c} onChange={(e) => right(e.target.value)} required /></label>
        <label className="fld"><span>✗ غلط</span><input id="wrong" name="wrong" type="number" inputMode="numeric" min={0} max={questions} value={w} onChange={(e) => { setW(e.target.value); setOwn(e.target.value !== '') }} required /></label>
      </div>
      <p className="muted small" id="marks-hint">
        {left == null ? `الواجب ${questions} سؤال. اكتب عدد الصح والباقي هيتحسب غلط.` : left > 0 ? `${left} سؤال الطالب محلّهوش.` : left < 0 ? `ده أكتر من ${questions} سؤال.` : `المجموع ${questions} سؤال.`}
      </p>
    </>
  )
}
