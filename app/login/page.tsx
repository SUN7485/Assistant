import Link from 'next/link'
import { login } from '../actions'
import { Submit } from '@/components/Submit'

export default function Login() {
  return (
    <main className="wrap login">
      <div className="hero">
        <span className="mark big">✓</span>
        <h1>مساعد المدرس</h1>
        <p className="muted">ادخل برقم موبايلك وكلمة السر اللي خدتها من السنتر.</p>
      </div>
      <form action={login} className="panel form">
        <label className="fld">
          <span>رقم الموبايل</span>
          <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="username" placeholder="01xxxxxxxxx" pattern="01[0-9]{9}" dir="ltr" required />
        </label>
        <label className="fld">
          <span>كلمة السر</span>
          <input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
        </label>
        <Submit>دخول</Submit>
      </form>
      <p className="muted small">نسيت كلمة السر؟ كلّم إدارة السنتر وهي تغيّرهالك.</p>
      <p className="small">
        <Link className="link" href="/setup">أول مرة تشغّل المنصة؟</Link>
      </p>
    </main>
  )
}
