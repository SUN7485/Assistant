import 'server-only'

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null; count: number | null }>

/**
 * Supabase hands back at most 1000 rows at a time (fewer if the project says so), without saying it stopped.
 * This reads every row, a page at a time, so a list or a total is never quietly cut short.
 * The query needs a stable order (order by its key) and `{ count: 'exact' }`, which says when to stop.
 */
export async function all<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = []
  for (;;) {
    const { data, error, count } = await page(out.length, out.length + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data?.length || (count != null ? out.length >= count : false)) return out
  }
}
