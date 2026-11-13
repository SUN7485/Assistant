/** Grades in order, oldest to newest; the dashed line is 50%. */
export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const W = 400, H = 70, p = 8
  const x = (i: number) => p + (i * (W - 2 * p)) / (values.length - 1)
  const y = (n: number) => H - p - (n / 100) * (H - 2 * p)
  const pts = values.map((n, i) => `${x(i)},${y(n)}`).join(' ')
  const last = values.length - 1
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="الدرجات من الأقدم للأحدث">
      <line x1={p} x2={W - p} y1={y(50)} y2={y(50)} stroke="var(--line)" strokeDasharray="4 4" />
      <polygon points={`${x(0)},${H - p} ${pts} ${x(last)},${H - p}`} fill="color-mix(in srgb, var(--accent) 12%, transparent)" />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      <circle cx={x(last)} cy={y(values[last])} r="4.5" fill="var(--accent)" />
    </svg>
  )
}
