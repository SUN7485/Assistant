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
  const { data, error } = await admin.auth.admin.createUser({ email: loginEmail(phone), password, email_confirm: true })
  if (error) return { error: error.code === 'email_exists' ? 'الرقم ده عنده حساب قبل كده' : 'الحساب متعملش: ' + error.message }
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

/** A six-digit password a student can type from a slip of paper. */
export const easyPassword = () => String(randomInt(100000, 1000000))

/** Photos are not rows: when their solutions are deleted, they have to be removed by hand. Never fails the action. */
export async function removePhotos(paths: string[]) {
  try {
    for (let i = 0; i < paths.length; i += 100) await adminDb().storage.from('solutions').remove(paths.slice(i, i + 100))
  } catch {
    // a leftover photo only costs space
  }
}
