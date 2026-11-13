import { can, need } from '@/lib/me'
import { togglePayment } from '../../actions'
import { Stat } from '@/components/Stat'
import { Submit } from '@/components/Submit'
import { fMonth, isMonth, money, thisMonth, wa } from '@/lib/util'

export default async function Payments({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { sb, me } = await need((me) => can(me, 'see_payments'))
  const { m } = await searchParams
  const month = m && isMonth(m) ? m : thisMonth()
  const admin = me.role === 'admin'
  const [{ data: students }, { data: pays }] = await Promise.all([
    sb.from('profiles').select('id, full_name, parent_phone, monthly_fee, group:groups!profiles_group_fk(name)').eq('role', 'student').order('full_name'),
    sb.from('payments').select('student_id, amount').eq('month', month),
  ])
  const paid = new Map((pays ?? []).map((p) => [p.student_id, p.amount]))
  const ss = students ?? []
  const done = ss.filter((s) => paid.has(s.id)), open = ss.filter((s) => !paid.has(s.id))

  return (
    <>
      <h1 className="h">الاشتراكات</h1>
      <form className="row" method="get">
        <label className="fld inline"><span>الشهر</span><input type="month" id="m" name="m" defaultValue={month} /></label>
        <button className="btn sm ghost2">اعرض الشهر ده</button>
      </form>
      <div className="stats">
        <Stat v={money(done.reduce((t, s) => t + (paid.get(s.id) ?? 0), 0))} l="اتحصّل" s={`${done.length} طالب دفعوا اشتراك ${fMonth(month)}`} />
        <Stat v={money(open.reduce((t, s) => t + s.monthly_fee, 0))} l="لسه متحصّلش" s={`${open.length} طالب لسه مدفعوش`} />
      </div>
      {ss.length ? (
        <section className="panel">
          <div className="tbl">
            <table>
              <thead><tr><th>الطالب</th><th>المجموعة</th><th>الاشتراك</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {[...open, ...done].map((s) => {
                  const isPaid = paid.has(s.id)
                  return (
                    <tr key={s.id}>
                      <td><b>{s.full_name}</b></td>
                      <td>{(s.group as unknown as { name: string } | null)?.name}</td>
                      <td>{money(isPaid ? paid.get(s.id)! : s.monthly_fee)}</td>
                      <td>{isPaid ? <span className="chip ok">مدفوع</span> : <span className="chip bad">لسه</span>}</td>
                      <td>
                        <div className="actions">
                          {admin && (
                            <form action={togglePayment}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="month" value={month} />
                              <input type="hidden" name="paid" value={isPaid ? '1' : '0'} />
                              <Submit className={'btn sm' + (isPaid ? ' ghost2' : '')}>{isPaid ? 'إلغاء الدفع' : 'سجّل إنه دفع'}</Submit>
                            </form>
                          )}
                          {!isPaid && s.parent_phone && (
                            <a className="link" target="_blank" rel="noopener" href={wa(s.parent_phone, `السلام عليكم، ده تذكير باشتراك ${s.full_name} لشهر ${fMonth(month)}: ${money(s.monthly_fee)}. شكرًا لحضرتك.`)}>فكّر ولي الأمر</a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="empty">لسه مفيش طلاب. ضيفهم من المجموعات والطلاب.</p>
      )}
    </>
  )
}
