import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { cleanPhone } from './phone'
export { PHONE, cleanPhone, latin, loginEmail } from './phone'

// ---------- dates: the centre is in Cairo, the server is not ----------
const TZ = 'Africa/Cairo'
const L = 'ar-EG-u-nu-latn'
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
export const thisMonth = () => today().slice(0, 7)
/** The Cairo day of a stored time. */
export const dayOf = (ts: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts))
export const daysAgo = (n: number) => {
  const d = new Date(today() + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'))
export const isMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
export const fDay = (s: string) =>
  new Intl.DateTimeFormat(L, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(s + 'T12:00:00Z'))
export const fTime = (s: string) =>
  new Intl.DateTimeFormat(L, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date(s))
export const fMonth = (m: string) =>
  new Intl.DateTimeFormat(L, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-01T12:00:00Z'))

// ---------- figures ----------
export const money = (n: number) => n.toLocaleString('en') + ' ج.م'
export const pct = (correct: number, wrong: number) => Math.round((correct / Math.max(1, correct + wrong)) * 100)
export function level(p: number | null): [string, string] {
  if (p == null) return ['لسه مفيش درجات', '']
  if (p >= 85) return ['ممتاز', 'ok']
  if (p >= 70) return ['جيد جدًا', 'ok']
  if (p >= 50) return ['جيد', 'warn']
  return ['محتاج متابعة', 'bad']
}
export const ATT: Record<string, [string, string]> = {
  present: ['حاضر', 'ok'],
  late: ['متأخر', 'warn'],
  absent: ['غايب', 'bad'],
}
export function attendanceOf(rows: { status: string }[]) {
  const c = { present: 0, late: 0, absent: 0 }
  rows.forEach((r) => c[r.status as keyof typeof c]++)
  const total = rows.length
  return { ...c, total, pct: total ? Math.round(((c.present + c.late) / total) * 100) : null }
}
export const byName = <T extends { full_name: string }>(a: T, b: T) => a.full_name.localeCompare(b.full_name, 'ar')
/** "3 طلاب", the way it is said. */
export const count = (n: number, one: string, two: string, few: string, many: string) =>
  n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`
export const nStudents = (n: number) => (n === 0 ? 'مفيش طلاب' : count(n, 'طالب واحد', 'طالبين', 'طلاب', 'طالب'))
export const average = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

export const wa = (phone: string, text: string) => `https://wa.me/2${phone}?text=${encodeURIComponent(text)}`

// ---------- form input ----------
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
/** A phone number as typed, in whatever digits and spacing, made plain. */
export const phone = (fd: FormData, k: string) => cleanPhone(str(fd, k))
export const isId = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
export const int = (fd: FormData, k: string) => {
  const n = Number(fd.get(k))
  return Number.isInteger(n) ? n : NaN
}

/** Where a form asks to be sent back to: a page of this app, never another site. */
export const localPath = (fd: FormData, fallback: string) => {
  const p = str(fd, 'back')
  return /^\/(?!\/)[^\\]*$/.test(p) ? p : fallback
}

/** Server actions only: go back to a page with a message the toast shows, and refresh the header's counts. */
export function back(path: string, text: string, error = false): never {
  revalidatePath('/', 'layout')
  redirect(`${path}${path.includes('?') ? '&' : '?'}${error ? 'err' : 'msg'}=${encodeURIComponent(text)}&at=${Date.now()}`)
}
