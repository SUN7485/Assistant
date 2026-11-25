import Link from 'next/link'
import { getMe, type Me } from '@/lib/me'
import { schemaBehind } from '@/lib/schema'
import { Nav } from '@/components/Nav'
import { logout } from '@/app/actions/auth'

function items(me: Me, newWork: number) {
  if (me.role === 'admin')
    return [
      { href: '/home', label: 'الرئيسية' },
      { href: '/teachers', label: 'المدرسين' },
      { href: '/groups', label: 'المجموعات' },
      { href: '/students', label: 'الطلاب' },
      { href: '/attendance', label: 'الحضور' },
      { href: '/grading', label: 'التصحيح', count: newWork },
      { href: '/payments', label: 'الاشتراكات' },
      { href: '/reports', label: 'التقارير' },
    ]
  if (me.role === 'teacher')
    return [
      { href: '/groups', label: 'مجموعاتي' },
      { href: '/students', label: 'طلابي' },
      ...(me.can_attendance ? [{ href: '/attendance', label: 'الحضور' }] : []),
      ...(me.can_grade ? [{ href: '/grading', label: 'التصحيح', count: newWork }] : []),
      ...(me.can_see_payments ? [{ href: '/payments', label: 'الاشتراكات' }] : []),
    ]
  return [
    { href: '/upload', label: 'ارفع الحل' },
    { href: '/my-attendance', label: 'حضوري' },
  ]
}

/**
 * The code was deployed before its database change was run: say so plainly instead of failing page by page.
 * Running the change is the developer's job, so nobody here is shown files or steps.
 */
function Behind() {
  return (
    <main className="wrap login">
      <div className="hero">
        <span className="mark big">!</span>
        <h1>المنصة بتتحدّث</h1>
      </div>
      <p className="panel">بنحدّث المنصة دلوقتي. جرّب تاني كمان شوية.</p>
      <form action={logout}><button className="link">خروج</button></form>
    </main>
  )
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { sb, me } = await getMe()
  const [behind, work] = await Promise.all([
    schemaBehind(sb),
    me.role === 'student' ? null : sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ])
  if (behind) return <Behind />
  const who = me.role === 'admin' ? 'مدير المنصة' : me.role === 'teacher' ? `${me.full_name}${me.subject ? ' · ' + me.subject : ''}` : me.full_name
  return (
    <>
      <header className="top">
        <div className="wrap topin">
          <Link className="brand" href="/account" title="حسابي وكلمة السر">
            <span className="mark">✓</span>
            <div>
              <b>مساعد المدرس</b>
              <small>{who} · حسابي</small>
            </div>
          </Link>
          <form action={logout}>
            <button className="ghost">خروج</button>
          </form>
        </div>
        <Nav items={items(me, work?.count ?? 0)} />
      </header>
      <main className="wrap main">{children}</main>
    </>
  )
}
