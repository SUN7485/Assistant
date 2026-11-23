'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { PHONE, cleanPhone, loginEmail } from '@/lib/phone'

/**
 * Signs in from the phone itself, not through the server: Supabase limits sign-ins per connection,
 * and through the server the whole centre would share one.
 */
export function LoginForm() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const phone = cleanPhone(String(fd.get('phone') ?? ''))
    if (!PHONE.test(phone)) return setErr('رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01')
    setBusy(true)
    setErr('')
    try {
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { error } = await sb.auth.signInWithPassword({ email: loginEmail(phone), password: String(fd.get('password') ?? '') })
      // a full page load on purpose, so the server sees the new session and no signed-out page is left cached
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (!error) return location.assign('/')
      setErr(error.status === 429 ? 'ناس كتير بتدخل دلوقتي. استنى دقيقة وجرّب تاني' : error.status === 400 ? 'الرقم أو كلمة السر غلط' : 'مفيش اتصال بالمنصة. اتأكد من النت وجرّب تاني')
    } catch {
      setErr('مفيش اتصال بالمنصة. اتأكد من النت وجرّب تاني')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={go} className="panel form">
      <label className="fld">
        <span>رقم الموبايل</span>
        <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="username" placeholder="01xxxxxxxxx" dir="ltr" required />
      </label>
      <label className="fld">
        <span>كلمة السر</span>
        <input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </label>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? 'لحظة…' : 'دخول'}</button>
    </form>
  )
}
