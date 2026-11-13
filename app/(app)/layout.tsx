import { getMe, type Me } from '@/lib/me'
import { Nav } from '@/components/Nav'
import { logout } from '../actions'

function items(me: Me, newWork: number) {
  if (me.role === 'admin')
    return [
      { href: '/home', label: 'الرئيسية' },
      { href: '/teachers', label: 'المدرسين والصلاحيات' },
      { href: '/groups', label: 'المجموعات والطلاب' },
      { href: '/attendance', label: 'الحضور والغياب' },
      { href: '/grading', label: 'التصحيح والدرجات', count: newWork },
      { href: '/payments', label: 'الاشتراكات' },
      { href: '/reports', label: 'التقارير والإشعارات' },
    ]
  if (me.role === 'teacher')
    return [
      { href: '/groups', label: 'مجموعاتي' },
      ...(me.can_attendance ? [{ href: '/attendance', label: 'الحضور والغياب' }] : []),
      ...(me.can_grade ? [{ href: '/grading', label: 'التصحيح', count: newWork }] : []),
      ...(me.can_see_payments ? [{ href: '/payments', label: 'الاشتراكات' }] : []),
    ]
  return [
    { href: '/upload', label: 'ارفع الحل' },
    { href: '/my-attendance', label: 'حضوري' },
  ]
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { sb, me } = await getMe()
  let newWork = 0
  if (me.role !== 'student') {
    const { count } = await sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'new')
    newWork = count ?? 0
  }
  const who = me.role === 'admin' ? 'مدير المنصة' : me.role === 'teacher' ? `${me.full_name}${me.subject ? ' · ' + me.subject : ''}` : me.full_name
  return (
    <>
      <header className="top">
        <div className="wrap topin">
          <div className="brand">
            <span className="mark">✓</span>
            <div>
              <b>مساعد المدرس</b>
              <small>{who}</small>
            </div>
          </div>
          <form action={logout}>
            <button className="ghost">خروج</button>
          </form>
        </div>
        <Nav items={items(me, newWork)} />
      </header>
      <main className="wrap main">{children}</main>
    </>
  )
}
