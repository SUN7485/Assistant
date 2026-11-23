import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="wrap login">
      <div className="hero">
        <span className="mark big">؟</span>
        <h1>الصفحة دي مش موجودة</h1>
        <p className="muted">ممكن تكون اتمسحت، أو مش من الحاجات اللي مسموح لك تشوفها.</p>
      </div>
      <div><Link className="btn" href="/">الصفحة الرئيسية</Link></div>
    </main>
  )
}
