import Link from 'next/link'
import { LoginForm } from '@/components/LoginForm'

export default function Login() {
  return (
    <main className="wrap login">
      <div className="hero">
        <span className="mark big">✓</span>
        <h1>مساعد المدرس</h1>
        <p className="muted">ادخل برقم موبايلك وكلمة السر اللي خدتها من السنتر.</p>
      </div>
      <LoginForm />
      <p className="muted small">نسيت كلمة السر؟ كلّم إدارة السنتر وهي تغيّرهالك.</p>
      <p className="small">
        <Link className="link" href="/setup">أول مرة تشغّل المنصة؟</Link>
      </p>
    </main>
  )
}
