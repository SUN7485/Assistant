import { describe, expect, it } from 'vitest'
import { pagesLabel } from '../lib/pages'
import { attendanceOf, average, count, isDay, isId, isMonth, level, localPath, money, nStudents, pct, wa } from '../lib/util'

const form = (o: Record<string, string>) => {
  const fd = new FormData()
  Object.entries(o).forEach(([k, v]) => fd.set(k, v))
  return fd
}

describe('grades', () => {
  it('is the share of right answers among those answered', () => {
    expect(pct(15, 5)).toBe(75)
    expect(pct(0, 0)).toBe(0) // nothing answered is not a crash
  })
  it('averages, or says there is nothing to average', () => {
    expect(average([75, 80])).toBe(78)
    expect(average([])).toBeNull()
  })
  it('names the level', () => {
    expect(level(null)[0]).toBe('لسه مفيش درجات')
    expect(level(90)[0]).toBe('ممتاز')
    expect(level(75)[0]).toBe('جيد جدًا')
    expect(level(50)[0]).toBe('جيد')
    expect(level(49)).toEqual(['محتاج متابعة', 'bad'])
  })
})

describe('attendance', () => {
  it('counts late as having come', () => {
    expect(attendanceOf([{ status: 'present' }, { status: 'late' }, { status: 'absent' }, { status: 'absent' }])).toEqual({ present: 1, late: 1, absent: 2, total: 4, pct: 50 })
  })
  it('has no percentage before the first class', () => expect(attendanceOf([]).pct).toBeNull())
})

describe('how things are said', () => {
  it('counts in Arabic', () => {
    expect([0, 1, 2, 3, 10, 11].map(nStudents)).toEqual(['مفيش طلاب', 'طالب واحد', 'طالبين', '3 طلاب', '10 طلاب', '11 طالب'])
    expect([1, 2, 3, 10].map(pagesLabel)).toEqual(['صفحة واحدة', 'صفحتين', '3 صفحات', '10 صفحات'])
    expect(count(5, 'a', 'b', 'few', 'many')).toBe('5 few')
  })
  it('writes money', () => expect(money(1250)).toBe('1,250 ج.م'))
  it('builds a WhatsApp link to an Egyptian number', () => expect(wa('01012345678', 'أهلا')).toBe('https://wa.me/201012345678?text=' + encodeURIComponent('أهلا')))
})

describe('what a form may send', () => {
  it('knows a day, a month and an id', () => {
    expect(isDay('2026-11-23')).toBe(true)
    expect(isDay('23/11/2026')).toBe(false)
    expect(isMonth('2026-11')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isId('00000000-0000-0000-0000-0000000000a1')).toBe(true)
    expect(isId("1' or '1'='1")).toBe(false)
  })
  it('only goes back to a page of this app', () => {
    expect(localPath(form({ back: '/students/abc?x=1' }), '/home')).toBe('/students/abc?x=1')
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', ''])
      expect(localPath(form({ back: bad }), '/home')).toBe('/home')
  })
})
