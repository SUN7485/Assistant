import { pct, type Grade } from '@/lib/util'

/** A grade at a glance: right, wrong, then unclear and blank when there are any, and the percentage. */
export function Score({ g }: { g: Grade }) {
  return (
    <span className="score">
      <span className="ok">✓ {g.correct}</span>
      <span className="bad">✗ {g.wrong}</span>
      {g.unclear > 0 && <span className="unclear">؟ غير مفهوم {g.unclear}</span>}
      {g.blank > 0 && <span className="blank">○ فاضي {g.blank}</span>}
      <b>{pct(g.correct, g.wrong)}%</b>
    </span>
  )
}
