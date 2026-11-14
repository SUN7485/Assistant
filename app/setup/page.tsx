import { redirect } from 'next/navigation'
import { setup } from '../actions'
import { adminDb } from '@/lib/supabase'
import { Submit } from '@/components/Submit'

export const dynamic = 'force-dynamic'

export default async function Setup() {
  const { count, error } = await adminDb().from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
  if (error || count) redirect('/login')
  return (
    <main className="wrap login">
      <div className="hero">
        <span className="mark big">✓</span>
        <h1>تشغيل المنصة</h1>
        <p className="muted">اعمل حساب مدير المنصة. الصفحة دي بتشتغل مرة واحدة بس، وبعدها بتقفل.</p>
      </div>
      <form action={setup} className="panel form">
        <label className="fld"><span>اسمك</span><input id="name" name="name" required minLength={2} /></label>
        <label className="fld"><span>رقم موبايلك</span><input id="phone" name="phone" type="tel" inputMode="numeric" placeholder="01xxxxxxxxx" pattern="01[0-9]{9}" dir="ltr" required /></label>
        <label className="fld"><span>كلمة السر (8 على الأقل)</span><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" dir="ltr" required /></label>
        <Submit>اعمل حساب المدير</Submit>
      </form>
    </main>
  )
}
