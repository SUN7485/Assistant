// Walks one day through the real app in Chromium: manager, two teachers and students.
// Needs a fresh local database and the app running on BASE:
//   npm run db:start && npm run db:env && npm run db:reset && npm run build && npm start &
//   npm run test:walk
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
let expectRefusal = false // a wrong password on purpose makes the browser log the refusal
page.on('console', (m) => m.type() === 'error' && !m.text().includes('fonts.g') && !(expectRefusal && m.text().includes('400')) && problems.push('console: ' + m.text()))

const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState('networkidle') }
const seen = (text) => page.locator('#toast', { hasText: text }).waitFor({ timeout: 10000 }).then(() => true, () => false)
// Pages stream in behind a placeholder, so "is it there" waits for it rather than looking once.
const has = (target) => (typeof target === 'string' ? page.locator(target) : target).first().waitFor({ timeout: 10000 }).then(() => true, () => false)
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
check(await has(page.locator('text=تلات خطوات')), 'an empty centre shows the three first steps')
await go('/setup')
check(page.url().includes('/login') || page.url().includes('/home'), 'setup closes once a manager exists')

// ---------- manager builds the centre ----------
await go('/teachers')
for (const [name, phone, subject] of [['أ. تجربة أول', '01111111111', 'رياضيات'], ['أ. تجربة تانى', '01111111112', 'فيزياء']]) {
  await page.fill('#t-name', name); await page.fill('#t-subject', subject); await page.fill('#t-phone', phone); await page.fill('#t-password', 'teach1')
  await page.click('button:has-text("إضافة المدرس")'); await page.waitForURL('**/teachers?**')
  check(await seen('اتضاف المدرس'), `added teacher ${phone}`)
  await page.locator('details.add summary').click().catch(() => {})
}
// second teacher: take away grading and attendance, and fix the spelling of the name
const t2 = page.locator('article', { hasText: '01111111112' })
await t2.locator('input[name=grade]').uncheck(); await t2.locator('input[name=attendance]').uncheck()
await t2.locator('button:has-text("حفظ الصلاحيات")').click(); await page.waitForURL('**/teachers?**')
check(await seen('اتحفظت'), 'saved the second teacher\'s permissions')
await t2.locator('summary:has-text("تعديل البيانات")').click()
await t2.locator('input[name=name]').fill('أ. تجربة تاني')
await t2.locator('button:has-text("حفظ البيانات")').click(); await page.waitForURL('**/teachers?**')
check(await seen('اتحفظت بيانات المدرس') && await has(page.locator('article b', { hasText: 'أ. تجربة تاني' })), 'corrected a teacher\'s name')
await shot('teachers'); await wide('teachers')

const addGroup = async (name, teacher, schedule, fee = '300') => {
  await go('/groups')
  if (!(await page.locator('#g-name').isVisible())) await page.click('summary:has-text("إضافة مجموعة")') // go() waited for the page
  await page.fill('#g-name', name); await page.selectOption('#g-teacher', { label: teacher }); await page.fill('#g-schedule', schedule); await page.fill('#g-fee', fee)
  await page.click('button:has-text("إضافة المجموعة")'); await page.waitForURL('**/groups?g=**')
  check(await seen('اتضافت'), 'added the group ' + name)
  return page.url().split('&')[0]
}
const addStudent = async (url, name, phone, says) => {
  await page.goto(url)
  await page.click('summary:has-text("إضافة طالب")')
  await page.fill('#s-name', name); await page.fill('#s-phone', phone); await page.fill('#s-password', 'stud11'); await page.fill('#s-parent', '01033333333')
  await page.click('button:has-text("إضافة الطالب")'); await page.waitForURL('**/groups?g=**')
  return seen(says)
}
const addHomework = async (url, title, questions) => {
  await page.goto(url)
  await page.click('summary:has-text("واجب جديد")')
  await page.fill('#w-title', title); await page.fill('#w-questions', questions)
  await page.click('button:has-text("إضافة الواجب")'); await page.waitForURL('**/groups?g=**')
  check(await seen('اتضاف الواجب'), 'added the homework ' + title)
}

const groupUrl = await addGroup('مجموعة السبت', 'أ. تجربة أول — رياضيات', 'السبت 4 م')
check(await addStudent(groupUrl, 'طالب أول', '01222222221', 'اتضاف الطالب'), 'added student 01222222221')
check(await addStudent(groupUrl, 'طالب تاني', '٠١٢ ٢٢٢٢ ٢٢٢٢', 'اتضاف الطالب'), 'added a student whose number was typed in Arabic digits with spaces')
check(await addStudent(groupUrl, 'مكرر', '01222222222', 'عنده حساب وموجود في المجموعة'), 'a phone number cannot be used twice in a group')
check(await addStudent(groupUrl, 'مدرس', '01111111111', 'بتاع المدرس'), 'a teacher\'s number cannot be added as a student')
await addHomework(groupUrl, 'تمارين التفاضل', '20')
await shot('groups'); await wide('groups')

// a second subject: the same student joins another teacher's group with the same account
const physicsUrl = await addGroup('فيزياء الأحد', 'أ. تجربة تاني — فيزياء', 'الأحد 6 م', '250')
check(await addStudent(physicsUrl, 'أي اسم', '01222222221', 'بنفس حسابه'), 'a student with an account joins a second group by phone number')
await addHomework(physicsUrl, 'مسائل الحركة', '10')
// the rest of the class, pasted as a list
await page.goto(physicsUrl)
await page.click('summary:has-text("إضافة قائمة طلاب")')
await page.fill('#b-list', 'طالبة تالتة، 01222222223، 01033333334\n01222222224\tطالب رابع\nسطر من غير رقم\nطالب تاني 01222222222')
await page.click('button:has-text("إضافة القائمة")')
await page.waitForSelector('#b-made')
const made = await page.locator('#b-made tbody tr').evaluateAll((rows) => rows.map((r) => [...r.cells].map((c) => c.textContent.trim())))
check(made.length === 3 && /^\d{8}$/.test(made[0][2]) && /^\d{8}$/.test(made[1][2]), 'pasted list made two new students with eight-digit passwords')
check(made[2][2].includes('عنده حساب'), 'pasted list put an existing student in the group without a new password')
check(await has(page.locator('text=مفيش رقم موبايل في السطر')), 'pasted list says which line it could not read')
await page.waitForSelector('tr:has-text("طالبة تالتة")')
check((await page.locator('section.panel .chip', { hasText: 'طلاب' }).first().textContent()).includes('4'), 'the group now has four students')
await shot('bulk'); await wide('bulk add')
const [thirdPhone, thirdPassword] = [made[0][1], made[0][2]]

// a student's file: fix the name, change a fee, and one account made by mistake
await go('/students?q=01222222224')
await page.waitForSelector('#students')
check((await page.locator('#students li').count()) === 1, 'search finds a student by number')
await page.click('#students a:has-text("طالب رابع")'); await page.waitForURL('**/students/**')
await page.click('summary:has-text("تعديل بيانات الطالب")')
await page.fill('#p-name', 'طالب رابع المعدّل'); await page.fill('#p-phone', '01222222225')
await page.click('details:has(#p-name) button:has-text("حفظ")'); await page.waitForURL('**/students/**?**')
check(await seen('هيدخل بالرقم الجديد') && await has(page.locator('h1', { hasText: 'طالب رابع المعدّل' })), 'changed a student\'s name and login number')
await page.click('#memberships summary:has-text("تعديل")')
await page.fill('#memberships input[name=fee]', '200'); await page.click('button:has-text("اشتراك خاص")'); await page.waitForURL('**/students/**?**')
check(await seen('اشتراك خاص') && await has(page.locator('text=الاشتراك 200')), 'gave one student a special fee for a group')
await page.click('#memberships summary:has-text("تعديل")')
await page.fill('#memberships input[name=fee]', ''); await page.click('button:has-text("اشتراك خاص")'); await page.waitForURL('**/students/**?**')
check(await seen('اشتراك المجموعة العادي') && await has(page.locator('text=الاشتراك 250')), 'an empty special fee puts the student back on the group\'s fee')
await page.click('summary:has-text("مسح حساب الطالب")'); await page.click('button:has-text("أيوه، امسح الحساب")'); await page.waitForURL('**/students?**')
await page.waitForSelector('#students')
check(await seen('اتمسح حساب') && (await page.locator('#students li').count()) === 3, 'deleted an account made by mistake')
await shot('students'); await wide('students')

await go('/attendance')
await page.locator('li', { hasText: 'طالب تاني' }).locator('label.absent').click()
await page.click('button:has-text("حفظ الحضور")'); await page.waitForURL('**/attendance?**')
check(await seen('1 غايب'), 'saved attendance with one absent')
await shot('attendance'); await wide('attendance')
await go('/reports')
await page.fill('#n-body', 'حصة السبت اتأجلت')
await page.click('button:has-text("جهّز الإشعار")'); await page.waitForURL('**/reports?**')
check(await seen('الإشعار جاهز'), 'prepared a notice')
await logout()

// ---------- student sends a photo ----------
await login('٠١٢٢٢٢٢٢٢٢١', 'stud11', '/upload')
const tabs = await page.locator('.tab').allTextContents()
check(tabs.length === 2, 'student sees only two tabs: ' + tabs.join(' | '))
check(await has(page.locator('#notices', { hasText: 'حصة السبت اتأجلت' })), 'student sees the centre\'s notice')
const options = await page.locator('#assignment option').allTextContents()
check(options.length === 2 && options.some((o) => o.includes('مجموعة السبت')) && options.some((o) => o.includes('فيزياء الأحد')), 'student in two groups sees both homeworks, each with its group')
await page.selectOption('#assignment', { label: 'تمارين التفاضل — مجموعة السبت' })
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
// the form moves on to the homework still waiting; go back to the one just sent
await page.waitForSelector('#assignment option:has-text("اتبعت")', { state: 'attached' })
await page.selectOption('#assignment', { label: 'تمارين التفاضل — مجموعة السبت — اتبعت' })
await page.waitForSelector('text=ده اللي وصل للأستاذ')
check(String(await widths('.thumb img')) === '300,330,320', 'student can look at the pages they sent')
check((await page.locator('button:has-text("ابعت الحل")').count()) === 0, 'nothing to send again until something changes')
// forgot a page: add it and send again
await page.setInputFiles('#shot', photo(340))
await page.click('button:has-text("ابعت الحل للأستاذ (4 صفحات)")')
check(await seen('وصل للأستاذ — 4 صفحات'), 'student added a forgotten page and sent again')
await page.waitForSelector('.list >> text=4 صفحات')
// change of mind: drop the second page; the teacher must end up with three and storage must let go of the fourth
await page.selectOption('#assignment', { label: 'تمارين التفاضل — مجموعة السبت — اتبعت' })
await page.waitForSelector('text=ده اللي وصل للأستاذ')
await page.click('.thumb >> nth=1'); await page.click('button:has-text("امسح الصفحة")')
await page.click('button:has-text("ابعت الحل للأستاذ (3 صفحات)")')
check(await seen('وصل للأستاذ — 3 صفحات'), 'student took a page back out')
await page.waitForSelector('.list >> text=3 صفحات')
// the other subject's homework goes to the other teacher
await page.selectOption('#assignment', { label: 'مسائل الحركة — فيزياء الأحد' })
await page.setInputFiles('#shot', photo(350))
await page.click('button:has-text("ابعت الحل للأستاذ")')
check(await seen('وصل للأستاذ'), 'student sent the second group\'s homework')
await page.waitForSelector('.list >> text=مسائل الحركة')
await shot('student-upload'); await wide('upload')
await go('/my-attendance')
check((await page.locator('.stat .v').first().textContent()) === '1', 'student sees their own attendance')
await go('/grading')
check(page.url().endsWith('/upload'), 'student cannot open grading')
// their own password
await go('/account')
await page.fill('#current', 'wrong-one'); await page.fill('#next', 'newpass1')
await page.click('button:has-text("غيّر كلمة السر")'); await page.waitForURL('**/account?**')
check(await seen('الحالية غلط'), 'changing the password needs the current one')
await page.fill('#current', 'stud11'); await page.fill('#next', 'newpass1')
await page.click('button:has-text("غيّر كلمة السر")'); await page.waitForURL('**/account?**')
check(await seen('اتغيرت كلمة السر'), 'student changed their own password')
await logout()
await go('/login')
expectRefusal = true
await page.fill('#phone', '01222222221'); await page.fill('#password', 'stud11'); await page.click('button:has-text("دخول")')
check(await has(page.locator('.error', { hasText: 'غلط' })), 'the old password no longer works')
expectRefusal = false

// a student made from the pasted list signs in with the password it gave
await login(thirdPhone, thirdPassword, '/upload')
check((await page.locator('#assignment option').allTextContents()).join() === 'مسائل الحركة', 'a student in one group sees only that group\'s homework')
await logout()

// ---------- teacher without permissions ----------
await login('01111111112', 'teach1', '/groups')
check((await page.locator('.tab').allTextContents()).length === 2, 'teacher without permissions sees only groups and students')
check(await has(page.locator('h2', { hasText: 'فيزياء الأحد' })) && (await page.locator('.chipbtn').count()) === 0, 'teacher two sees their own group and no other')
await go('/attendance')
check(!page.url().includes('/attendance'), 'teacher without attendance permission is turned away')
await go('/grading')
check(!page.url().includes('/grading'), 'teacher without grading permission is turned away')
await logout()

// ---------- teacher grades ----------
await login('01111111111', 'teach1', '/grading')
check((await page.locator('.sub').count()) === 1, 'teacher sees only the work sent to them, not what a shared student sent another teacher')
check((await page.locator('.sub .cover span').textContent()) === '3 صفحات', 'grading list says how many pages')
await page.click('.sub')
await page.waitForURL('**/grading/**')
check(String(await widths('.pager img')) === '300,320,340', 'teacher sees the student\'s pages in order')
await page.click('button:has-text("اللي بعدها")')
check(await page.locator('#viewer-count', { hasText: 'صفحة 2 من 3' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'teacher can turn to the next page')
await page.click('.viewer .thumb >> nth=2')
check(await page.locator('#viewer-count', { hasText: 'صفحة 3 من 3' }).waitFor({ timeout: 5000 }).then(() => true, () => false), 'teacher can jump to a page')
await shot('teacher-pages'); await wide('grading one')
await page.fill('#correct', '15')
check((await page.inputValue('#wrong')) === '5', 'typing the right answers fills in the wrong ones')
await page.fill('#wrong', '9')
await page.click('button:has-text("رصد الدرجة")'); await page.waitForURL('**/grading/**')
check(await seen('أكتر من 20'), 'more answers than questions is refused')
await page.fill('#correct', '15'); await page.fill('#wrong', '5'); await page.fill('#note', 'السؤال 4: نسيت الإشارة')
await page.click('button:has-text("رصد الدرجة")'); await page.waitForURL((u) => u.pathname === '/grading')
check(await seen('15 من 20'), 'teacher graded 15 of 20')
check((await page.locator('.tab .cnt').count()) === 0, 'grading tab count clears after grading')
await shot('teacher-grading'); await wide('grading')
// who has not sent
await go('/groups')
await page.click('a:has-text("1 من 2 بعتوا الحل")'); await page.waitForURL('**/homework/**')
await page.waitForSelector('#missing')
check((await page.locator('#missing li').count()) === 1 && await has(page.locator('#missing', { hasText: 'طالب تاني' })), 'homework page lists who has not sent')
check((await page.locator('#missing a:has-text("فكّر ولي الأمر")').getAttribute('href')).startsWith('https://wa.me/201033333333'), 'reminder goes to the parent on WhatsApp')
await page.click('summary:has-text("تعديل الواجب")'); await page.fill('#w-questions', '12')
await page.click('details:has(#w-title) button:has-text("حفظ")'); await page.waitForURL('**/homework/**?**')
check(await seen('اتصحح على 20'), 'homework cannot shrink below a grade already given')
await shot('homework'); await wide('homework')
await go('/payments')
check(!page.url().includes('/payments'), 'teacher without the payments permission is turned away')
await go('/teachers')
check(!page.url().includes('/teachers'), 'teacher cannot open the teachers page')
await logout()

// ---------- manager: money and reports ----------
await login('01000000000', 'manager-pass', '/home')
check((await page.locator('.tab .cnt').textContent()) === '1', 'manager sees the solution still waiting with the other teacher')
await go('/payments')
check((await page.locator('#lines li', { hasText: 'طالب أول' }).count()) === 2, 'a student in two groups has a payment line for each')
await page.locator('#lines li', { hasText: 'طالب أول' }).filter({ hasText: 'مجموعة السبت' }).locator('button:has-text("سجّل إنه دفع")').click()
await page.waitForURL('**/payments?**')
check(await seen('اتسجّل'), 'recorded a payment')
check(await has(page.locator('#lines li', { hasText: 'طالب أول' }).filter({ hasText: 'فيزياء الأحد' }).locator('.chip.bad')), 'paying for one group leaves the other unpaid')
await shot('payments'); await wide('payments')
await go('/groups')
await page.locator('tr', { hasText: 'طالب أول' }).locator('a:has-text("ملف الطالب")').click()
await page.waitForURL('**/students/**')
check(await has(page.locator('text=✓ 15')), 'student file shows the grade')
check((await page.locator('#memberships > li').count()) === 2, 'student file lists both groups')
await wide('student file'); await shot('student-file')
await page.click('a:has-text("تقرير لولي الأمر")'); await page.waitForURL('**/reports?s=**')
const report = await page.locator('pre.report').textContent()
check(report.includes('15 من 20') && report.includes('مدفوع') && report.includes('لسه مدفعش'), 'report has the grade, and each group\'s payment')
check((await page.locator('a:has-text("ابعته واتساب")').getAttribute('href')).startsWith('https://wa.me/201033333333'), 'WhatsApp link goes to the parent')
await shot('reports'); await wide('reports')
// leaving a group keeps its history
await page.goBack(); await page.waitForURL('**/students/**')
await page.locator('#memberships > li', { hasText: 'فيزياء الأحد' }).locator('summary').click()
await page.locator('#memberships > li', { hasText: 'فيزياء الأحد' }).locator('button:has-text("شيله من المجموعة")').click(); await page.waitForURL('**/students/**?**')
check(await seen('اتشال من المجموعة') && (await has('#memberships')) && (await page.locator('#memberships > li').count()) === 1, 'took the student out of one group')
// a wrong day's attendance is taken back, and a finished group is archived
await go('/attendance')
await page.click('summary:has-text("يوم غلط")'); await page.click('button:has-text("امسح حضور اليوم ده")'); await page.waitForURL('**/attendance?**')
check(await seen('اتمسح حضور'), 'took back a class written on the wrong day')
await page.goto(physicsUrl)
await page.click('summary:has-text("تعديل المجموعة")'); await page.click('button:has-text("أرشفة المجموعة")'); await page.waitForURL('**/groups?**')
check(await seen('اتأرشفت') && await has(page.locator('a', { hasText: 'المجموعات المؤرشفة (1)' })), 'archived a group')
await go('/payments')
check((await page.locator('#lines li', { hasText: 'فيزياء الأحد' }).count()) === 0, 'an archived group leaves the payments list')
// a group and a homework made by mistake are deleted; a group with anything recorded in it is not
const mistake = await addGroup('مجموعة بالغلط', 'أ. تجربة أول — رياضيات', '')
await addHomework(mistake, 'واجب بالغلط', '5')
await page.click('a:has-text("واجب بالغلط")'); await page.waitForURL('**/homework/**')
await page.click('summary:has-text("تعديل الواجب")'); await page.click('summary:has-text("مسح الواجب")'); await page.click('button:has-text("أيوه، امسحه")'); await page.waitForURL('**/groups?g=**')
check(await seen('اتمسح الواجب'), 'deleted a homework')
await page.click('summary:has-text("تعديل المجموعة")'); await page.click('button:has-text("مسح المجموعة")'); await page.waitForURL('**/groups?**')
check(await seen('اتمسحت المجموعة') && !(await page.locator('.chipbtn', { hasText: 'مجموعة بالغلط' }).count()), 'deleted an empty group')
await page.goto(groupUrl); await page.click('summary:has-text("تعديل المجموعة")')
check((await page.locator('button:has-text("مسح المجموعة")').count()) === 0, 'a group with students and homework offers archiving, not deleting')
await go('/home')
check(await page.locator('text=غاب آخر حصتين').count() === 0, 'nobody flagged for two absences')
await shot('home'); await wide('home')
await logout()

// ---------- the student never sees the score ----------
await login('01222222221', 'newpass1', '/upload')
await page.waitForSelector('text=الأستاذ راجعه')
const html = await page.content()
check(!html.includes('15 من') && !html.includes('نسيت الإشارة'), 'student page has no score and no teacher note')
check(await has(page.locator('text=مفيش واجبات مستنية حل')), 'reviewed homework cannot be sent again, and the archived group\'s is closed')

await browser.close()
console.log(problems.length ? `\n${problems.length} problem(s):\n- ` + problems.join('\n- ') : '\nall good')
process.exit(problems.length ? 1 : 0)
