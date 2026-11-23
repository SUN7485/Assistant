import Link from 'next/link'
import { can, need } from '@/lib/me'
import { togglePayment } from '@/app/actions/money'
import { Stat } from '@/components/Stat'
import { Submit } from '@/components/Submit'
import { all } from '@/lib/data'
import { feeOf, fMonth, isMonth, money, nStudents, thisMonth, wa } from '@/lib/util'

/** One line per student per group: each group is paid for on its own. */
export default async function Payments({ searchParams }: { searchParams: Promise<{ m?: string; g?: string }> }) {
  const { sb, me } = await need((me) => can(me, 'see_payments'))
  const { m, g: asked } = await searchParams
  const month = m && isMonth(m) ? m : thisMonth()
  const admin = me.role === 'admin'
  // Read whole, a page at a time: a big centre has more lines than one request returns.
  const [{ data: groups }, roster, special, pays] = await Promise.all([
    sb.from('groups').select('id, name, monthly_fee').is('archived_at', null).order('created_at'),
    all((a, b) => sb.from('enrollments').select('group_id, student:profiles(id, full_name, parent_phone)', { count: 'exact' }).order('student_id').order('group_id').range(a, b)),
    all((a, b) => sb.from('special_fees').select('student_id, group_id, monthly_fee', { count: 'exact' }).order('student_id').order('group_id').range(a, b)),
    all((a, b) => sb.from('payments').select('student_id, group_id, amount', { count: 'exact' }).eq('month', month).order('student_id').order('group_id').range(a, b)),
  ])
  const g = groups?.find((x) => x.id === asked)
  const group = new Map((groups ?? []).map((x) => [x.id, x]))
  const name = new Map((groups ?? []).map((x) => [x.id, x.name]))
  const key = (student: string, grp: string) => student + grp
  const own = new Map(special.map((f) => [key(f.student_id, f.group_id), f]))
  const paid = new Map(pays.map((p) => [key(p.student_id, p.group_id), p.amount]))
  const lines = roster
    .filter((e) => group.has(e.group_id) && (!g || e.group_id === g.id))
    .map((e) => ({ ...e, monthly_fee: feeOf(group.get(e.group_id)!, own.get(key(e.student.id, e.group_id))), got: paid.get(key(e.student.id, e.group_id)) }))
    .sort((a, b) => Number(a.got != null) - Number(b.got != null) || a.student.full_name.localeCompare(b.student.full_name, 'ar'))
  const open = lines.filter((l) => l.got == null)
  // Money that came in counts even when the student has since left the group.
  const collected = pays.filter((p) => !g || p.group_id === g.id).reduce((t, p) => t + p.amount, 0)
  const here = `/payments?m=${month}${g ? '&g=' + g.id : ''}`

  return (
    <>
      <h1 className="h">الاشتراكات</h1>
      <form className="row" method="get">
        {g && <input type="hidden" name="g" value={g.id} />}
        <label className="fld inline"><span>الشهر</span><input type="month" id="m" name="m" defaultValue={month} /></label>
        <button className="btn sm ghost2">اعرض الشهر ده</button>
      </form>
      {(groups?.length ?? 0) > 1 && (
        <div className="chips">
          <Link href={`/payments?m=${month}`} className={'chipbtn' + (!g ? ' on' : '')}>كل المجموعات</Link>
          {groups!.map((x) => <Link key={x.id} href={`/payments?m=${month}&g=${x.id}`} className={'chipbtn' + (x.id === g?.id ? ' on' : '')}>{x.name}</Link>)}
        </div>
      )}
      <div className="stats">
        <Stat v={money(collected)} l="اتحصّل" s={`${lines.length - open.length} اشتراك اتدفع عن ${fMonth(month)}`} />
        <Stat v={money(open.reduce((t, l) => t + l.monthly_fee, 0))} l="لسه متحصّلش" s={open.length ? `${open.length} اشتراك لسه` : 'كله اتدفع'} />
      </div>
      {lines.length ? (
        <section className="panel">
          <ul className="list" id="lines">
            {lines.map((l) => (
              <li key={key(l.student.id, l.group_id)}>
                <div>
                  <Link className="link plain" href={`/students/${l.student.id}`}><b>{l.student.full_name}</b></Link>
                  <div className="muted small">{name.get(l.group_id)} · {money(l.got ?? l.monthly_fee)}</div>
                </div>
                <div className="actions">
                  {l.got != null ? <span className="chip ok">مدفوع</span> : <span className="chip bad">لسه</span>}
                  {l.got == null && l.student.parent_phone && (
                    <a className="link small" target="_blank" rel="noopener" href={wa(l.student.parent_phone, `السلام عليكم، ده تذكير باشتراك ${l.student.full_name} في ${name.get(l.group_id)} عن شهر ${fMonth(month)}: ${money(l.monthly_fee)}. شكرًا لحضرتك.`)}>فكّر ولي الأمر</a>
                  )}
                  {admin && (
                    <form action={togglePayment}>
                      <input type="hidden" name="student" value={l.student.id} />
                      <input type="hidden" name="group" value={l.group_id} />
                      <input type="hidden" name="month" value={month} />
                      <input type="hidden" name="back" value={here} />
                      <input type="hidden" name="paid" value={l.got != null ? '1' : '0'} />
                      <Submit className={'btn sm' + (l.got != null ? ' ghost2' : '')}>{l.got != null ? 'إلغاء الدفع' : 'سجّل إنه دفع'}</Submit>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="muted small">{nStudents(new Set(lines.map((l) => l.student.id)).size)} · الطالب اللي في أكتر من مجموعة له سطر لكل مجموعة.</p>
        </section>
      ) : (
        <p className="empty">لسه مفيش طلاب. ضيفهم من صفحة المجموعات.</p>
      )}
    </>
  )
}
