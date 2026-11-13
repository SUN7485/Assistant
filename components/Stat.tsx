export function Stat({ v, l, s }: { v: React.ReactNode; l: string; s: string }) {
  return (
    <div className="stat">
      <span className="v">{v}</span>
      <span className="l">{l}</span>
      <span className="s">{s}</span>
    </div>
  )
}
