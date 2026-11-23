import Link from 'next/link'
import { notFound } from 'next/navigation'
import { can, need } from '@/lib/me'
import { grade } from '@/app/actions/daily'
import { Marks } from '@/components/Marks'
import { PageViewer } from '@/components/PageViewer'
import { Submit } from '@/components/Submit'
import { pagesLabel } from '@/lib/pages'
import { fTime, isId } from '@/lib/util'

export default async function GradeOne({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sb } = await need((me) => can(me, 'grade'))
  if (!isId(id)) notFound()
  const { data: x } = await sb
    .from('submissions')
    .select('id, status, created_at, photo_paths, student:profiles(id, full_name), assignment:assignments(id, title, questions, group:groups(name)), grades(correct, wrong, note)')
    .eq('id', id)
    .maybeSingle()
  if (!x) notFound()
  const { data: signed } = await sb.storage.from('solutions').createSignedUrls(x.photo_paths, 3600)
  const pages = (signed ?? []).flatMap((u) => (u.signedUrl ? [u.signedUrl] : []))
  const g = x.grades

  return (
    <>
      <Link className="link back" href={x.status === 'new' ? '/grading' : '/grading?tab=reviewed'}>→ رجوع لقائمة الحلول</Link>
      <div className="grade">
        <PageViewer key={x.id} pages={pages} name={x.student.full_name} />
        <form action={grade} className="panel form" key={x.id}>
          <input type="hidden" name="id" value={x.id} />
          <div className="row">
            <div>
              <h2><Link className="link plain" href={`/students/${x.student.id}`}>{x.student.full_name}</Link></h2>
              <div className="muted small">
                <Link className="link plain" href={`/homework/${x.assignment.id}`}>{x.assignment.title}</Link> · {x.assignment.group.name} · {x.assignment.questions} سؤال · {pagesLabel(x.photo_paths.length)} · اتبعت {fTime(x.created_at)}
              </div>
            </div>
            {g && <div className="result">{g.correct}<small>من {g.correct + g.wrong}</small></div>}
          </div>
          <Marks questions={x.assignment.questions} correct={g?.correct} wrong={g?.wrong} />
          <label className="fld">
            <span>تصحيح الأخطاء والملاحظة</span>
            <textarea id="note" name="note" rows={4} maxLength={2000} placeholder="مثلاً: السؤال 4 — نسيت تغيّر الإشارة" defaultValue={g?.note} />
          </label>
          <p className="muted small">الطالب مش بيشوف عدد الصح والغلط ولا الملاحظة. بيشوف بس إن حله اتراجع.</p>
          <div><Submit>{g ? 'حفظ التعديل' : 'رصد الدرجة'}</Submit></div>
        </form>
      </div>
    </>
  )
}
