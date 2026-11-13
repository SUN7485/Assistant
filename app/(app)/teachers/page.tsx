import { need, isAdmin } from '@/lib/me'
import { addTeacher, resetPassword, savePermissions } from '../../actions'
import { Submit } from '@/components/Submit'

const PERMS = [
  ['attendance', 'can_attendance', 'تسجيل الحضور والغياب'],
  ['grade', 'can_grade', 'تصحيح الحلول ورصد الدرجات'],
  ['add_students', 'can_add_students', 'إضافة طلاب'],
  ['see_payments', 'can_see_payments', 'رؤية الاشتراكات'],
] as const

export default async function Teachers() {
  const { sb } = await need(isAdmin)
  const [{ data: teachers }, { data: groups }] = await Promise.all([
    sb.from('profiles').select('*').eq('role', 'teacher').order('created_at'),
    sb.from('groups').select('teacher_id'),
  ])
  return (
    <>
      <h1 className="h">المدرسين والصلاحيات</h1>
      <p className="lead">كل مدرس بيشوف مجموعاته وطلابه بس. علّم على اللي مسموح له يعمله واضغط حفظ.</p>
      {teachers?.length ? (
        <div className="grid">
          {teachers.map((t) => (
            <article className="card" key={t.id}>
              <div className="row">
                <div>
                  <b>{t.full_name}</b>
                  <div className="muted">{t.subject} · <span dir="ltr">{t.phone}</span></div>
                </div>
                <span className="chip">{(groups ?? []).filter((g) => g.teacher_id === t.id).length} مجموعة</span>
              </div>
              <form action={savePermissions} className="perms">
                <input type="hidden" name="id" value={t.id} />
                {PERMS.map(([k, col, label]) => (
                  <label className="sw" key={k}>
                    <input type="checkbox" name={k} id={`${t.id}-${k}`} defaultChecked={t[col]} />
                    <span>{label}</span>
                  </label>
                ))}
                <div><Submit className="btn sm">حفظ الصلاحيات</Submit></div>
              </form>
              <details>
                <summary className="link small">تغيير كلمة السر</summary>
                <form action={resetPassword} className="actions" style={{ paddingTop: 8 }}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="back" value="/teachers" />
                  <input name="password" id={`${t.id}-pw`} aria-label="كلمة السر الجديدة" placeholder="كلمة السر الجديدة" minLength={6} required dir="ltr" />
                  <Submit className="btn sm ghost2">غيّر</Submit>
                </form>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">لسه مفيش مدرسين. ضيف أول مدرس من تحت.</p>
      )}
      <details className="panel add" open={!teachers?.length}>
        <summary>إضافة مدرس</summary>
        <form action={addTeacher} className="formgrid">
          <label className="fld"><span>الاسم</span><input id="t-name" name="name" placeholder="أ. ..." required minLength={2} /></label>
          <label className="fld"><span>المادة</span><input id="t-subject" name="subject" placeholder="مثلاً: رياضيات" required /></label>
          <label className="fld"><span>الموبايل (هيدخل بيه)</span><input id="t-phone" name="phone" type="tel" placeholder="01xxxxxxxxx" pattern="01[0-9]{9}" dir="ltr" required /></label>
          <label className="fld"><span>كلمة السر</span><input id="t-password" name="password" minLength={6} dir="ltr" required /></label>
          <Submit>إضافة المدرس</Submit>
        </form>
      </details>
    </>
  )
}
