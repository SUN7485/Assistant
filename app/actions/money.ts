'use server'

import { back, isMonth, localPath, str } from '@/lib/util'
import { staffOnly } from './shared'

/** Records that a student paid for one group for one month, or takes that back. */
export async function togglePayment(fd: FormData) {
  const month = str(fd, 'month'), gid = str(fd, 'group'), sid = str(fd, 'student')
  const path = localPath(fd, `/payments?m=${month}`)
  const { sb } = await staffOnly((me) => me.role === 'admin', path)
  if (!isMonth(month)) back('/payments', 'الشهر مش صحيح', true)
  if (fd.get('paid') === '1') {
    const { error } = await sb.from('payments').delete().eq('student_id', sid).eq('group_id', gid).eq('month', month)
    if (error) back(path, error.message, true)
    back(path, 'اتلغى تسجيل الدفع')
  }
  const { data: e } = await sb.from('enrollments').select('monthly_fee, student:profiles(full_name)').eq('student_id', sid).eq('group_id', gid).maybeSingle()
  if (!e) back(path, 'الطالب مش في المجموعة دي', true)
  const { error } = await sb.from('payments').insert({ student_id: sid, group_id: gid, month, amount: e.monthly_fee })
  if (error) back(path, error.code === '23505' ? 'الاشتراك ده متسجل قبل كده' : error.message, true)
  back(path, `اتسجّل اشتراك ${e.student.full_name}`)
}

export async function addNotice(fd: FormData) {
  const { sb } = await staffOnly((me) => me.role === 'admin', '/reports')
  const g = str(fd, 'group')
  const { error } = await sb.from('notices').insert({ group_id: g === 'all' ? null : g, body: str(fd, 'body') })
  if (error) back('/reports', 'الإشعار متحفظش: ' + error.message, true)
  back('/reports', 'الإشعار جاهز: الطلاب شايفينه في المنصة، وتقدر تبعته لأولياء الأمور من تحت')
}

export async function deleteNotice(fd: FormData) {
  const { sb } = await staffOnly((me) => me.role === 'admin', '/reports')
  const { error } = await sb.from('notices').delete().eq('id', str(fd, 'id'))
  if (error) back('/reports', 'الإشعار متمسحش: ' + error.message, true)
  back('/reports', 'اتمسح الإشعار')
}
