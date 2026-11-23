import { redirect } from 'next/navigation'
import { setup } from '@/app/actions/auth'
import { adminDb } from '@/lib/supabase'
import { Submit } from '@/components/Submit'

export const dynamic = 'force-dynamic'

/** Says what is wrong with the server's settings, instead of quietly sending the visitor to /login. */
async function problem(): Promise<string | 'has-admin' | null> {
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
    (k) => !process.env[k]?.trim(),
  )
  if (missing.length) return `ناقص في Vercel (Environment Variables): ${missing.join(', ')}`
  try {
    // Not head: a HEAD request comes back with no error text, so a refusal would say nothing.
    const { data, error, status } = await adminDb().from('profiles').select('id').eq('role', 'admin').limit(1)
    if (error) {
      if (status === 401 || status === 403)
        return `SUPABASE_SERVICE_ROLE_KEY مش مظبوط (${status}). انسخ الـ secret / service_role key تاني من Supabase. ${error.message ?? ''}`
      if (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/.test(error.message))
        return 'جداول قاعدة البيانات مش موجودة. شغّل ملفات supabase/migrations في Supabase SQL Editor.'
      if (/api key|jwt|unauthori[sz]ed|forbidden/i.test(error.message) || error.code === '401')
        return 'SUPABASE_SERVICE_ROLE_KEY مش مظبوط. انسخ الـ secret / service_role key تاني من Supabase.'
      return `قاعدة البيانات رفضت (${status}): ` + ([error.code, error.message, error.hint].filter(Boolean).join(' — ') || 'من غير سبب')
    }
    return data?.length ? 'has-admin' : null
  } catch (e) {
    return 'السيرفر مش قادر يوصل لـ Supabase. راجع NEXT_PUBLIC_SUPABASE_URL: ' + (e instanceof Error ? e.message : String(e))
  }
}

export default async function Setup() {
  const err = await problem()
  if (err === 'has-admin') redirect('/login?msg=' + encodeURIComponent('حساب المدير معمول خلاص. ادخل بيه.'))
  if (err)
    return (
      <main className="wrap login">
        <div className="hero">
          <span className="mark big">!</span>
          <h1>المنصة مش جاهزة لسه</h1>
        </div>
        <div className="panel">
          <p className="error" dir="auto">{err}</p>
          <p className="muted small">
            بعد ما تصلّح الإعدادات في Vercel، اعمل Redeploy (Deployments ← ⋯ ← Redeploy) وافتح الصفحة دي تاني.
          </p>
        </div>
      </main>
    )
  return (
    <main className="wrap login">
      <div className="hero">
        <span className="mark big">✓</span>
        <h1>تشغيل المنصة</h1>
        <p className="muted">اعمل حساب مدير المنصة. الصفحة دي بتشتغل مرة واحدة بس، وبعدها بتقفل.</p>
      </div>
      <form action={setup} className="panel form">
        <label className="fld"><span>اسمك</span><input id="name" name="name" required minLength={2} /></label>
        <label className="fld"><span>رقم موبايلك</span><input id="phone" name="phone" type="tel" inputMode="numeric" placeholder="01xxxxxxxxx" dir="ltr" required /></label>
        <label className="fld"><span>كلمة السر (8 على الأقل)</span><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" dir="ltr" required /></label>
        <Submit>اعمل حساب المدير</Submit>
      </form>
    </main>
  )
}
