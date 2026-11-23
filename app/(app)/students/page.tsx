import Link from 'next/link'
import { need, isStaff } from '@/lib/me'
import { all as readAll } from '@/lib/data'
import { byName, cleanPhone, nStudents } from '@/lib/util'

/** Every student in one list, found by name or number. A teacher sees their own. */
export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const { sb, me } = await need(isStaff)
  const { q = '', f } = await searchParams
  const everyone = await readAll((a, b) =>
    sb.from('profiles').select('id, full_name, phone, parent_phone, enrollments(group:groups(id, name, archived_at))', { count: 'exact' }).eq('role', 'student').order('id').range(a, b),
  )
  const all = everyone.sort(byName)
  const term = q.trim(), digits = cleanPhone(term)
  const noGroup = (s: (typeof all)[number]) => !s.enrollments.some((e) => !e.group.archived_at)
  const loose = all.filter(noGroup)
  const found = all.filter(
    (s) => (!term || s.full_name.includes(term) || (/^[0-9]+$/.test(digits) && (s.phone.includes(digits) || s.parent_phone?.includes(digits)))) && (f !== 'none' || noGroup(s)),
  )

  return (
    <>
      <h1 className="h">{me.role === 'admin' ? 'الطلاب' : 'طلابي'}</h1>
      <form method="get" className="actions">
        <input id="q" name="q" type="search" defaultValue={term} placeholder="دوّر بالاسم أو رقم الموبايل" aria-label="بحث عن طالب" className="grow" />
        <button className="btn sm ghost2">بحث</button>
        {(term || f) && <Link className="link small" href="/students">كل الطلاب</Link>}
      </form>
      {me.role === 'admin' && loose.length > 0 && f !== 'none' && (
        <p className="muted small">
          <Link className="link" href="/students?f=none">{nStudents(loose.length)} مش في أي مجموعة شغالة</Link> — افتح ملف الطالب وضيفه لمجموعة، أو امسح حسابه لو اتعمل بالغلط.
        </p>
      )}
      {found.length ? (
        <section className="panel">
          <div className="muted small">{term || f ? `${nStudents(found.length)} من ${all.length}` : nStudents(all.length)}</div>
          <ul className="list" id="students">
            {found.map((s) => (
              <li key={s.id}>
                <div>
                  <Link className="link" href={`/students/${s.id}`}><b>{s.full_name}</b></Link>
                  <div className="muted small" dir="ltr">{s.phone}</div>
                </div>
                <div className="chips">
                  {s.enrollments.filter((e) => !e.group.archived_at).map((e) => <Link key={e.group.id} className="chip" href={`/groups?g=${e.group.id}`}>{e.group.name}</Link>)}
                  {noGroup(s) && <span className="chip warn">مش في مجموعة</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="empty">{all.length ? 'مفيش طالب بالاسم أو الرقم ده.' : 'لسه مفيش طلاب. ضيفهم من صفحة المجموعات.'}</p>
      )}
    </>
  )
}
