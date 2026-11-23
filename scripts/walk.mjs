// Walks one day through the real app in Chromium: manager, teacher and student.
// Needs: local Supabase running with a fresh database (npx supabase db reset), the app on BASE
// (npm run build && npm start), and Playwright with Chromium installed.
import { createRequire } from 'node:module'
import { deflateSync } from 'node:zlib'
const { chromium } = createRequire(import.meta.url)('playwright') // global install works too (NODE_PATH)

const BASE = process.env.BASE ?? 'http://localhost:3000'
const SHOTS = process.env.SHOTS // folder for screenshots, optional
const problems = []
const check = (ok, what) => { if (!ok) problems.push(what); console.log((ok ? 'ok   ' : 'FAIL ') + what) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => problems.push('page error: ' + e.message))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('fonts.g') && problems.push('console: ' + m.text()))

const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState('networkidle') }
const seen = (text) => page.locator('#toast', { hasText: text }).waitFor({ timeout: 10000 }).then(() => true, () => false)
const wide = async (name) => check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `no sideways scroll on ${name}`)
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
async function login(phone, password, lands) {
  await go('/login')
  await page.fill('#phone', phone)
  await page.fill('#password', password)
  await page.click('button:has-text("دخول")')
  const ok = await page.waitForURL((u) => u.pathname === lands, { timeout: 10000 }).then(() => true, () => false)
  check(ok, `${phone} lands on ${lands}`)
  await page.waitForLoadState('networkidle')
}
// A plain grey PNG of a given size, standing in for a photo. Each page gets its own width so their order can be checked.
function png(w, h) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)) } return ~c >>> 0 }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length); body.copy(out, 4); out.writeUInt32BE(crc(body), body.length + 4)
    return out
  }
  const head = Buffer.alloc(13); head.writeUInt32BE(w); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2
  const rows = Buffer.alloc(h * (1 + w * 3), 0x99); for (let y = 0; y < h; y++) rows[y * (1 + w * 3)] = 0
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', head), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
}
const photo = (w) => ({ name: `page-${w}.png`, mimeType: 'image/png', buffer: png(w, 400) })
const widths = (sel) => page.locator(sel).evaluateAll((imgs) => Promise.all(imgs.map((i) => i.decode().then(() => i.naturalWidth, () => 0))))
const logout = async () => { await page.click('button:has-text("خروج")'); await page.waitForURL('**/login') }

// ---------- first run ----------
await go('/home')
check(page.url().includes('/login'), 'signed-out visitor is sent to login')
await go('/setup')
await page.fill('#name', 'مدير التجربة')
await page.fill('#phone', '01000000000')
await page.fill('#password', 'manager-pass')
await page.click('button:has-text("اعمل حساب المدير")')
await page.waitForURL('**/home**')
check(true, 'setup made the manager and signed in')
await go('/setup')
check(page.url().includes('/login') || page.url().includes('/home'), 'setup closes once a manager exists')

// ---------- manager builds the centre ----------
await go('/teachers')
for (const [name, phone, subject] of [['أ. تجربة أول', '01111111111', 'رياضيات'], ['أ. تجربة تاني', '01111111112', 'فيزياء']]) {
  await page.fill('#t-name', name); await page.fill('#t-subject', subject); await page.fill('#t-phone', phone); await page.fill('#t-password', 'teach1')
  await page.click('button:has-text("إضافة المدرس")'); await page.waitForURL('**/teachers?**')
  check(await seen('اتضاف المدرس'), `added teacher ${phone}`)
  await page.locator('details.add summary').click().catch(() => {})
}
// second teacher: take away grading and attendance
const t2 = page.locator('article', { hasText: '01111111112' })
await t2.locator('input[name=grade]').uncheck(); await t2.locator('input[name=attendance]').uncheck()
await t2.locator('button:has-text("حفظ الصلاحيات")').click(); await page.waitForURL('**/teachers?**')
check(await seen('اتحفظت'), 'saved the second teacher\'s permissions')
await shot('teachers'); await wide('teachers')

await go('/groups')
await page.fill('#g-name', 'مجموعة السبت'); await page.selectOption('#g-teacher', { label: 'أ. تجربة أول — رياضيات' }); await page.fill('#g-schedule', 'السبت 4 م')
await page.click('button:has-text("إضافة المجموعة")'); await page.waitForURL('**/groups?g=**')
check(await seen('اتضافت'), 'added a group')
const groupUrl = page.url().split('&')[0]
for (const [name, phone] of [['طالب أول', '01222222221'], ['طالب تاني', '01222222222']]) {
  await page.goto(groupUrl)
  await page.click('summary:has-text("إضافة طالب")')
  await page.fill('#s-name', name); await page.fill('#s-phone', phone); await page.fill('#s-password', 'stud11'); await page.fill('#s-parent', '01033333333')
  await page.click('button:has-text("إضافة الطالب")'); await page.waitForURL('**/groups?g=**')
  check(await seen('اتضاف الطالب'), `added student ${phone}`)
}
await page.goto(groupUrl)
await page.click('summary:has-text("إضافة طالب")')
await page.fill('#s-name', 'مكرر'); await page.fill('#s-phone', '01222222222'); await page.fill('#s-password', 'stud11')
await page.click('button:has-text("إضافة الطالب")'); await page.waitForURL('**/groups?g=**')
check(await seen('عنده حساب'), 'a phone number cannot be used twice')
await page.goto(groupUrl)
await page.click('summary:has-text("واجب جديد")')
await page.fill('#w-title', 'تمارين التفاضل'); await page.fill('#w-questions', '20')
await page.click('button:has-text("إضافة الواجب")'); await page.waitForURL('**/groups?g=**')
check(await seen('اتضاف الواجب'), 'added homework')
await shot('groups'); await wide('groups')

await go('/attendance')
await page.locator('li', { hasText: 'طالب تاني' }).locator('label.absent').click()
await page.click('button:has-text("حفظ الحضور")'); await page.waitForURL('**/attendance?**')
check(await seen('1 غايب'), 'saved attendance with one absent')
await shot('attendance'); await wide('attendance')
await logout()

// ---------- student sends a photo ----------
await login('01222222221', 'stud11', '/upload')
const tabs = await page.locator('.tab').allTextContents()
check(tabs.length === 2, 'student sees only two tabs: ' + tabs.join(' | '))
// three pages: one from the camera, then three picked together, then one of them thrown away
await page.setInputFiles('#shot', photo(300))
await page.waitForSelector('text=صفحة 1 من 1')
await page.setInputFiles('#pick', [photo(310), photo(320), photo(330)])
await page.waitForSelector('text=صفحة 4 من 4')
check(true, 'student added four pages, from the camera and from the gallery')
await page.click('.thumb >> nth=1'); await page.click('button:has-text("امسح الصفحة")')
await page.waitForSelector('text=من 3')
await page.click('.thumb >> nth=2'); await page.click('button:has-text("قدّمها")')
check(String(await widths('.thumb img')) === '300,330,320', 'student removed a page and moved another earlier')
await shot('student-pages'); await wide('upload with pages')
await page.click('button:has-text("ابعت الحل للأستاذ (3 صفحات)")')
await page.waitForURL('**/upload?msg=**', { timeout: 15000 }).catch(() => {})
check(await seen('وصل للأستاذ — 3 صفحات'), 'student\'s three pages reached the teacher')
await page.waitForSelector('text=ده اللي وصل للأستاذ')
check(String(await widths('.thumb img')) === '300,330,320', 'student can look at the pages they sent')
check((await page.locator('button:has-text("ابعت الحل")').count()) === 0, 'nothing to send again until something changes')
// forgot a page: add it and send again
await page.setInputFiles('#shot', photo(340))
await page.click('button:has-text("ابعت الحل للأستاذ (4 صفحات)")')
check(await seen('وصل للأستاذ — 4 صفحات'), 'student added a forgotten page and sent again')
await page.waitForSelector('.list >> text=4 صفحات')
// change of mind: drop the second page; the teacher must end up with three and storage must let go of the fourth
await page.waitForSelector('text=ده اللي وصل للأستاذ')
await page.click('.thumb >> nth=1'); await page.click('button:has-text("امسح الصفحة")')
await page.click('button:has-text("ابعت الحل للأستاذ (3 صفحات)")')
check(await seen('وصل للأستاذ — 3 صفحات'), 'student took a page back out')
await page.waitForSelector('.list >> text=3 صفحات')
await shot('student-upload'); await wide('upload')
await go('/my-attendance')
check((await page.locator('.stat .v').first().textContent()) === '1', 'student sees their own attendance')
await go('/grading')
check(page.url().endsWith('/upload'), 'student cannot open grading')
await logout()

// ---------- teacher without permissions ----------
await login('01111111112', 'teach1', '/groups')
check((await page.locator('.tab').allTextContents()).length === 1, 'teacher without permissions sees one tab')
check(await page.locator('text=مفيش مجموعات باسمك').isVisible(), 'teacher two sees no other teacher\'s group')
await go('/attendance')
check(!page.url().includes('/attendance'), 'teacher without attendance permission is turned away')
await logout()

// ---------- teacher grades ----------
await login('01111111111', 'teach1', '/grading')
check((await page.locator('.sub .cover span').textContent()) === '3 صفحات', 'grading list says how many pages')
await page.click('.sub')
await page.waitForURL('**/grading/**')
check(String(await widths('.pager img')) === '300,320,340', 'teacher sees the student\'s pages in order')
await page.click('button:has-text("اللي بعدها")')
check(await page.locator('#viewer-count', { hasText: 'صفحة 2 من 3' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'teacher can turn to the next page')
await page.click('.viewer .thumb >> nth=2')
check(await page.locator('#viewer-count', { hasText: 'صفحة 3 من 3' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'teacher can jump to a page')
await shot('teacher-pages'); await wide('grading one')
await page.fill('#correct', '15'); await page.fill('#wrong', '9')
await page.click('button:has-text("رصد الدرجة")'); await page.waitForURL('**/grading/**')
check(await seen('أكتر من 20'), 'more answers than questions is refused')
await page.fill('#correct', '15'); await page.fill('#wrong', '5'); await page.fill('#note', 'السؤال 4: نسيت الإشارة')
await page.click('button:has-text("رصد الدرجة")'); await page.waitForURL((u) => u.pathname === '/grading')
check(await seen('15 من 20'), 'teacher graded 15 of 20')
check((await page.locator('.tab .cnt').count()) === 0, 'grading tab count clears after grading')
await shot('teacher-grading'); await wide('grading')
await go('/payments')
check(!page.url().includes('/payments'), 'teacher without the payments permission is turned away')
await go('/teachers')
check(!page.url().includes('/teachers'), 'teacher cannot open the teachers page')
await logout()

// ---------- manager: money and reports ----------
await login('01000000000', 'manager-pass', '/home')
await go('/payments')
await page.locator('tr', { hasText: 'طالب أول' }).locator('button:has-text("سجّل إنه دفع")').click()
await page.waitForURL('**/payments?**')
check(await seen('اتسجّل'), 'recorded a payment')
await shot('payments'); await wide('payments')
await go('/groups')
await page.locator('tr', { hasText: 'طالب أول' }).locator('a:has-text("ملف الطالب")').click()
await page.waitForURL('**/students/**')
check(await page.locator('text=✓ 15').isVisible(), 'student file shows the grade')
await wide('student file')
await page.click('a:has-text("تقرير لولي الأمر")'); await page.waitForURL('**/reports?s=**')
const report = await page.locator('pre.report').textContent()
check(report.includes('15 من 20') && report.includes('مدفوع'), 'report has the grade and the payment')
check((await page.locator('a:has-text("ابعته واتساب")').getAttribute('href')).startsWith('https://wa.me/201033333333'), 'WhatsApp link goes to the parent')
await page.fill('#n-body', 'حصة السبت اتأجلت')
await page.click('button:has-text("جهّز الإشعار")'); await page.waitForURL('**/reports?**')
check(await seen('الإشعار جاهز'), 'prepared a notice')
await shot('reports'); await wide('reports')
await go('/home')
check(await page.locator('text=غاب آخر حصتين').count() === 0, 'nobody flagged for two absences after one class')
await shot('home'); await wide('home')
await logout()

// ---------- the student never sees the score ----------
await login('01222222221', 'stud11', '/upload')
await page.waitForSelector('text=الأستاذ راجعه')
const html = await page.content()
check(!html.includes('15 من') && !html.includes('نسيت الإشارة'), 'student page has no score and no teacher note')
check(await page.locator('text=مفيش واجبات مستنية حل').isVisible(), 'reviewed homework cannot be sent again')

await browser.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n- ` + problems.join('\n- ') : '\nall good')
process.exit(problems.length ? 1 : 0)
