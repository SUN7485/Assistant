'use client'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { addStudents, type BulkResult } from '@/app/actions/people'
import { CopyButton } from './CopyButton'

/** Paste a class list; each new student gets a password, shown here once to hand out. */
export function BulkAdd({ group }: { group: string }) {
  const router = useRouter()
  const [res, run, busy] = useActionState(async (prev: BulkResult | null, fd: FormData) => {
    const r = await addStudents(prev, fd)
    if (r.made.length) router.refresh() // the roster above
    return r
  }, null)
  const sheet = (res?.made ?? []).map((m) => `${m.name} — ${m.phone} — ${m.password ?? 'كلمة سره القديمة'}`).join('\n')

  return (
    <div className="form">
      <form action={run} className="form">
        <input type="hidden" name="group" value={group} />
        <label className="fld">
          <span>كل طالب في سطر: الاسم، رقم موبايله، وبعده رقم ولي الأمر لو موجود</span>
          <textarea id="b-list" name="list" rows={6} dir="auto" required placeholder={'أحمد علي، 01012345678، 01198765432\nمنى سعيد، 01022223333'} />
        </label>
        <label className="fld narrow"><span>اشتراك المجموعة دي في الشهر (ج.م)</span><input id="b-fee" name="fee" type="number" min={0} step={10} defaultValue={300} /></label>
        <p className="muted small">تقدر تنسخ القائمة من إكسل أو واتساب زي ما هي. كل طالب جديد هياخد كلمة سر من 6 أرقام تظهر لك هنا مرة واحدة.</p>
        <div><button className="btn" disabled={busy}>{busy ? 'بيتضافوا…' : 'إضافة القائمة'}</button></div>
      </form>
      {res?.error && <p className="error" role="alert">{res.error}</p>}
      {!!res?.made.length && (
        <div className="form" role="status">
          <b>اتضاف {res.made.length}. دي بيانات الدخول — انسخها دلوقتي، كلمات السر مش هتظهر تاني:</b>
          <div className="tbl">
            <table id="b-made">
              <thead><tr><th>الطالب</th><th>الموبايل</th><th>كلمة السر</th></tr></thead>
              <tbody>
                {res.made.map((m) => (
                  <tr key={m.phone}><td>{m.name}</td><td dir="ltr">{m.phone}</td><td dir="ltr">{m.password ?? <span className="muted">{m.note}</span>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div><CopyButton text={sheet} label="انسخ بيانات الدخول" /></div>
        </div>
      )}
      {!!res?.skipped.length && (
        <div role="alert">
          <b className="error">{res.skipped.length} سطر متضافش:</b>
          <ul className="plain">
            {res.skipped.map((s, i) => <li key={i}><span dir="auto">{s.line}</span> — <span className="muted">{s.why}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
