import 'server-only'
import { randomInt } from 'node:crypto'
import { getMe, type Me } from '@/lib/me'
import { adminDb } from '@/lib/supabase'
import type { TablesInsert } from '@/lib/database.types'
import { PHONE, back, loginEmail } from '@/lib/util'

// Every action checks who is calling. The database checks again (row-level security),
// except where adminDb() is used, which is why those actions check the role first.

export async function staffOnly(test: (me: Me) => boolean, path: string) {
  const r = await getMe()
  if (!test(r.me)) back(path, 'مش مسموح لك تعمل ده', true)
  return r
}

type NewProfile = Omit<TablesInsert<'profiles'>, 'id' | 'phone'>

/** Makes a login and its profile together; undoes the login if the profile is refused. */
export async function createAccount(phone: string, password: string, profile: NewProfile): Promise<{ id: string } | { error: string }> {
  if (!PHONE.test(phone)) return { error: 'رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01' }
  if (password.length < 6) return { error: 'كلمة السر لازم تكون 6 حروف أو أرقام على الأقل' }
  const admin = adminDb()
  const make = () => admin.auth.admin.createUser({ email: loginEmail(phone), password, email_confirm: true })
  let { data, error } = await make()
  if (error?.code === 'email_exists') {
    // A login with no profile is the leftover of an attempt that was cut off; it would block this number for good.
    const { data: dropped } = await admin.rpc('drop_orphan_login', { mail: loginEmail(phone) })
    if (dropped) ({ data, error } = await make())
  }
  if (error || !data.user) return { error: error?.code === 'email_exists' ? 'الرقم ده عنده حساب قبل كده' : 'الحساب متعملش: ' + (error?.message ?? '') }
  const { error: e2 } = await admin.from('profiles').insert({ id: data.user.id, phone, ...profile })
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: 'البيانات مش مظبوطة: ' + e2.message }
  }
  return { id: data.user.id }
}

/** Takes back an account made a moment ago, when the step after it failed. */
export const dropAccount = (id: string) => adminDb().auth.admin.deleteUser(id)

/** Who owns a phone number, whoever is asking. Call only after the caller's role has been checked. */
export async function whoHas(phone: string) {
  const { data } = await adminDb().from('profiles').select('id, full_name, role').eq('phone', phone).maybeSingle()
  return data
}

/** An eight-digit password: a student can type it from a slip of paper, and it is too long to guess through the login. */
export const easyPassword = () => String(randomInt(10_000_000, 100_000_000))

/**
 * After a solution is sent: removes the pages it replaced, and any photo for that homework older than an hour
 * that the solution does not use (an upload that was abandoned). Newer strays are left: another tab may be mid-send.
 */
export async function tidyPhotos(student: string, assignment: string, replaced: string[], keep: string[]) {
  try {
    const { data } = await adminDb().storage.from('solutions').list(student, { limit: 1000, search: assignment + '-' })
    const hourAgo = Date.now() - 3600_000
    const stale = (data ?? []).filter((f) => f.created_at && new Date(f.created_at).getTime() < hourAgo).map((f) => `${student}/${f.name}`)
    await removePhotos([...new Set([...replaced, ...stale])].filter((p) => !keep.includes(p)))
  } catch {
    // tidying is never worth failing a send for
  }
}

/** Photos are not rows: when their solutions are deleted, they have to be removed by hand. Never fails the action. */
export async function removePhotos(paths: string[]) {
  if (!paths.length) return
  try {
    for (let i = 0; i < paths.length; i += 100) await adminDb().storage.from('solutions').remove(paths.slice(i, i + 100))
  } catch {
    // a leftover photo only costs space
  }
}
