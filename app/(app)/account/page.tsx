import { getMe } from '@/lib/me'
import { changePassword } from '@/app/actions/auth'
import { Submit } from '@/components/Submit'

const ROLE = { admin: 'مدير المنصة', teacher: 'مدرس', student: 'طالب' }

export default async function Account() {
  const { me } = await getMe()
  const least = me.role === 'admin' ? 8 : 6
  return (
    <>
      <h1 className="h">حسابي</h1>
      <section className="panel">
        <div>
          <h2>{me.full_name}</h2>
          <div className="muted">{ROLE[me.role]}{me.subject ? ' · ' + me.subject : ''} · بتدخل برقم <span dir="ltr">{me.phone}</span></div>
        </div>
        {me.role !== 'admin' && <p className="muted small">الاسم أو الرقم غلط؟ كلّم إدارة السنتر وهي تعدّله.</p>}
      </section>
      <section className="panel">
        <h2>تغيير كلمة السر</h2>
        <form action={changePassword} className="form narrow">
          <label className="fld"><span>كلمة السر الحالية</span><input id="current" name="current" type="password" autoComplete="current-password" dir="ltr" required /></label>
          <label className="fld"><span>كلمة السر الجديدة ({least} على الأقل)</span><input id="next" name="next" type="password" autoComplete="new-password" minLength={least} dir="ltr" required /></label>
          <div><Submit>غيّر كلمة السر</Submit></div>
        </form>
        {me.role !== 'admin' && <p className="muted small">نسيت الحالية؟ إدارة السنتر تقدر تديك كلمة سر جديدة.</p>}
      </section>
    </>
  )
}
