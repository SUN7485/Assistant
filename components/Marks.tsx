'use client'
import { useState } from 'react'

type Counts = { correct?: number; wrong?: number; unclear?: number; blank?: number }
const str = (n?: number) => (n == null ? '' : String(n))
const num = (v: string) => (v === '' ? 0 : Number(v))
const ok = (v: string) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0)

/**
 * Right, wrong, unclear and blank counts. Typing the others fills in the rest as wrong, until the teacher types
 * the wrong count themself. Unclear and blank may be left empty (0); whatever is left over is saved as blank.
 */
export function Marks({ questions, correct, wrong, unclear, blank }: { questions: number } & Counts) {
  const [c, setC] = useState(str(correct))
  const [w, setW] = useState(str(wrong))
  const [u, setU] = useState(unclear ? String(unclear) : '')
  const [b, setB] = useState(blank ? String(blank) : '')
  const [own, setOwn] = useState(wrong != null) // the teacher chose the wrong count; leave it alone

  // after any count but wrong changes: wrong is what is left, unless the teacher typed it
  function fill(next: { c?: string; u?: string; b?: string }) {
    const nc = next.c ?? c, nu = next.u ?? u, nb = next.b ?? b
    if (next.c != null) setC(nc)
    if (next.u != null) setU(nu)
    if (next.b != null) setB(nb)
    if (own) return
    const rest = questions - num(nc) - num(nu) - num(nb)
    setW(nc !== '' && ok(nc) && ok(nu) && ok(nb) && rest >= 0 ? String(rest) : '')
  }
  const left = c !== '' && w !== '' ? questions - num(c) - num(w) - num(u) - num(b) : null

  return (
    <>
      <div className="two">
        <label className="fld"><span>✓ صح</span><input id="correct" name="correct" type="number" inputMode="numeric" min={0} max={questions} value={c} onChange={(e) => fill({ c: e.target.value })} required /></label>
        <label className="fld"><span>✗ غلط</span><input id="wrong" name="wrong" type="number" inputMode="numeric" min={0} max={questions} value={w} onChange={(e) => { setW(e.target.value); setOwn(e.target.value !== '') }} required /></label>
      </div>
      <div className="two">
        <label className="fld"><span>؟ غير مفهوم</span><input id="unclear" name="unclear" type="number" inputMode="numeric" min={0} max={questions} placeholder="0" value={u} onChange={(e) => fill({ u: e.target.value })} /></label>
        <label className="fld"><span>○ فاضي</span><input id="blank" name="blank" type="number" inputMode="numeric" min={0} max={questions} placeholder="0" value={b} onChange={(e) => fill({ b: e.target.value })} /></label>
      </div>
      <p className="muted small" id="marks-hint">
        {left == null ? `الواجب ${questions} سؤال. اكتب عدد الصح والباقي هيتحسب غلط.` : left > 0 ? `${left} سؤال لسه متحسبوش، هيتحسبوا فاضي.` : left < 0 ? `ده أكتر من ${questions} سؤال.` : `المجموع ${questions} سؤال.`}
      </p>
      <p className="muted small">غير مفهوم: إجابة مش واضحة أو مش عارف تحكم عليها، المدرس هيشوفها ويراجعها. فاضي: سؤال الطالب سابه من غير حل.</p>
    </>
  )
}
