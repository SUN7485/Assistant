import type { Db } from './supabase'

/**
 * The database version this code needs. Each file in supabase/migrations that changes what the app
 * relies on raises schema_version() in the database; raise this with it.
 */
export const SCHEMA = 4
/** The file that brings the database to each version, for the message the manager sees. */
export const MIGRATION: Record<number, string> = { 4: '20261124000000_enrollments.sql' }

let okUntil = 0

/** How far the database is behind the code: 0 when it is not, or when it cannot be told (a network blip must not lock people out). */
export async function schemaBehind(sb: Db): Promise<number> {
  if (Date.now() < okUntil) return 0
  const { data, error } = await sb.rpc('schema_version')
  if (error) return error.code === 'PGRST202' || error.code === '42883' ? SCHEMA : 0 // no such function: older than version 4
  if (data >= SCHEMA) {
    okUntil = Date.now() + 10 * 60_000
    return 0
  }
  return SCHEMA - data
}

let signupChecked = 0, signupWasOpen = false

/**
 * Whether the Supabase project still lets anyone sign themselves up. Accounts are meant to be made only inside
 * the app; this is a switch in the Supabase dashboard that is easy to forget. False when it cannot be told.
 */
export async function signupOpen(): Promise<boolean> {
  if (Date.now() < signupChecked + 10 * 60_000) return signupWasOpen
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    if (!res.ok) return false
    signupWasOpen = (await res.json()).disable_signup === false
    signupChecked = Date.now()
    return signupWasOpen
  } catch {
    return false
  }
}
