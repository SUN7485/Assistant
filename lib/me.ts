import { cache } from 'react'
import { redirect } from 'next/navigation'
import { db } from './supabase'

export type Me = {
  id: string
  role: 'admin' | 'teacher' | 'student'
  full_name: string
  phone: string
  subject: string | null
  group_id: string | null
  can_attendance: boolean
  can_grade: boolean
  can_add_students: boolean
  can_see_payments: boolean
}

/** The signed-in person and a database client acting as them. Once per request. */
export const getMe = cache(async () => {
  const sb = await db()
  const { data: auth } = await sb.auth.getClaims()
  const id = auth?.claims.sub
  if (!id) redirect('/login')
  const { data } = await sb.from('profiles').select('*').eq('id', id).single()
  if (!data) redirect('/login?err=' + encodeURIComponent('الحساب ده ملوش ملف. كلّم الإدارة.'))
  return { sb, me: data as Me }
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
