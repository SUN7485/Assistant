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
