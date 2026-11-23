'use server'

import { redirect } from 'next/navigation'
import { getMe } from '@/lib/me'
import { adminDb, db } from '@/lib/supabase'
import { back, loginEmail, phone as phoneOf, str } from '@/lib/util'
import { createAccount } from './shared'

// Signing in happens in the browser (components/LoginForm.tsx), so each person is rate-limited
// on their own connection instead of everyone sharing the server's.

export async function logout() {
  const sb = await db()
  await sb.auth.signOut()
  redirect('/login')
}

/** First run only: makes the manager's account while there is no manager yet. */
export async function setup(fd: FormData) {
  const admin = adminDb()
  const { count, error } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
  if (error || count) redirect('/login')
  const phone = phoneOf(fd, 'phone'), password = String(fd.get('password') ?? '')
  if (password.length < 8) back('/setup', 'كلمة سر المدير لازم تكون 8 حروف أو أرقام على الأقل', true)
  const made = await createAccount(phone, password, { role: 'admin', full_name: str(fd, 'name') })
  if ('error' in made) back('/setup', made.error, true)
  const sb = await db()
  await sb.auth.signInWithPassword({ email: loginEmail(phone), password })
  back('/home', 'أهلاً! ابدأ بإضافة المدرسين')
}

/** Anyone changes their own password, after proving they know the current one. */
export async function changePassword(fd: FormData) {
  const { sb, me } = await getMe()
  const now = String(fd.get('current') ?? ''), next = String(fd.get('next') ?? '')
  const least = me.role === 'admin' ? 8 : 6
  if (next.length < least) back('/account', `كلمة السر الجديدة لازم تكون ${least} حروف أو أرقام على الأقل`, true)
  if (next === now) back('/account', 'كلمة السر الجديدة زي القديمة', true)
  const { error: wrong } = await sb.auth.signInWithPassword({ email: loginEmail(me.phone), password: now })
  if (wrong) back('/account', wrong.status === 429 ? 'محاولات كتير. استنى دقيقة وجرّب تاني' : 'كلمة السر الحالية غلط', true)
  const { error } = await sb.auth.updateUser({ password: next })
  if (error) back('/account', 'كلمة السر متغيرتش: ' + error.message, true)
  back('/account', 'اتغيرت كلمة السر')
}
