import { cleanPhone, latin } from './phone'

export type RosterLine = { line: string; name: string; phone: string; parent: string }

/**
 * Reads a pasted class list, one student per line: a name, the student's number and, if there, the parent's number,
 * in any order and with any separators ("أحمد علي، 01012345678، 01198765432", or copied from a spreadsheet).
 */
export function parseRoster(text: string): RosterLine[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const plain = latin(line)
      const numbers = (plain.match(/\+?[0-9][0-9 \-]{8,}[0-9]/g) ?? []).map(cleanPhone)
      const name = plain
        .replace(/\+?[0-9][0-9 \-]{8,}[0-9]/g, ' ')
        .replace(/[,،;|\t:]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[\s\-–.]+|[\s\-–.]+$/g, '')
      return { line, name, phone: numbers[0] ?? '', parent: numbers[1] ?? '' }
    })
}
