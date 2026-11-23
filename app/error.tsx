'use client'

/** Anything that fails while a page is being put together ends here, in words, with a way to try again. */
export default function Failed({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="wrap login">
      <div className="hero">
        <span className="mark big">!</span>
        <h1>حصلت مشكلة</h1>
        <p className="muted">الصفحة مفتحتش. غالبًا النت وقع لحظة أو المنصة مشغولة.</p>
      </div>
      <div className="actions">
        <button className="btn" onClick={reset}>جرّب تاني</button>
        {/* a full page load on purpose: whatever broke should not survive in memory */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="btn ghost2" href="/">الصفحة الرئيسية</a>
      </div>
      {error.digest && <p className="muted small">لو المشكلة فضلت، ابعت الرقم ده للدعم: <span dir="ltr">{error.digest}</span></p>}
    </main>
  )
}
