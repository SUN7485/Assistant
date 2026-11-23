import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from './supabase'
import type { Tables } from './database.types'

export type Role = 'admin' | 'teacher' | 'student'
export type Me = Omit<Tables<'profiles'>, 'role'> & { role: Role }

/**
 * The signed-in person and a database client acting as them. Once per request.
 * The session token is checked by its signature (no round trip when the project signs with a public key);
 * the profile is then read with that same token, so a forged one reads nothing.
 */
export const getMe = cache(async () => {
  const sb = await db()
  const { data } = await sb.auth.getClaims()
  const uid = data?.claims.sub
  if (!uid) redirect('/login')
  const { data: me } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle()
  if (!me) redirect('/login?err=' + encodeURIComponent('الحساب ده ملوش ملف. كلّم الإدارة.'))
  return { sb, me: me as Me }
})

export type Can = 'attendance' | 'grade' | 'add_students' | 'see_payments'
export const can = (me: Me, what: Can) => me.role === 'admin' || (me.role === 'teacher' && me[`can_${what}`])

/** Pages call this first; anyone else goes back to their own start page. */
export async function need(ok: (me: Me) => boolean) {
  const r = await getMe()
  if (!ok(r.me)) redirect('/')
  return r
}
export const isAdmin = (me: Me) => me.role === 'admin'
export const isStaff = (me: Me) => me.role !== 'student'
export const isStudent = (me: Me) => me.role === 'student'
