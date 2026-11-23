import { describe, expect, it } from 'vitest'
import { cleanPhone } from '../lib/phone'
import { parseRoster } from '../lib/roster'

describe('cleanPhone', () => {
  it('accepts the ways people type an Egyptian mobile number', () => {
    for (const typed of ['01012345678', '٠١٠١٢٣٤٥٦٧٨', '010 1234 5678', '010-1234-5678', '+201012345678', '201012345678'])
      expect(cleanPhone(typed)).toBe('01012345678')
  })
  it('leaves a wrong number wrong', () => {
    expect(cleanPhone('1012345678')).toBe('1012345678')
  })
})

describe('parseRoster', () => {
  const rows = parseRoster(`أحمد علي، 01012345678، 01198765432
منى سعيد\t٠١٠٢٢٢٢٣٣٣٣

01055556666 كريم حسن
سارة محمود - 010 1111 2222 - +20 122 333 4444
بدون رقم
يوسف: 01234567890`)
  it('reads one student per line and skips empty lines', () => expect(rows).toHaveLength(6))
  it('takes the first number as the student and the second as the parent', () =>
    expect(rows[0]).toMatchObject({ name: 'أحمد علي', phone: '01012345678', parent: '01198765432' }))
  it('reads Arabic digits and tabs from a spreadsheet', () => expect(rows[1]).toMatchObject({ name: 'منى سعيد', phone: '01022223333', parent: '' }))
  it('does not mind the number coming first', () => expect(rows[2]).toMatchObject({ name: 'كريم حسن', phone: '01055556666' }))
  it('reads spaced and international numbers', () =>
    expect(rows[3]).toMatchObject({ name: 'سارة محمود', phone: '01011112222', parent: '01223334444' }))
  it('keeps a line with no number, for the caller to report', () => expect(rows[4]).toMatchObject({ name: 'بدون رقم', phone: '' }))
  it('drops a colon after the name', () => expect(rows[5]).toMatchObject({ name: 'يوسف', phone: '01234567890' }))
})
