/** Most photos in one solution. The database refuses more (submissions_pages). */
export const MAX_PAGES = 10

export const pagesLabel = (n: number) => (n === 1 ? 'صفحة واحدة' : n === 2 ? 'صفحتين' : n <= 10 ? `${n} صفحات` : `${n} صفحة`)
