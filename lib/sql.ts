import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** The text of a file under supabase/, to paste into Supabase on first setup. Empty if it cannot be read. */
export async function sql(...file: string[]) {
  try {
    return await readFile(path.join(process.cwd(), 'supabase', ...file), 'utf8')
  } catch {
    return ''
  }
}
