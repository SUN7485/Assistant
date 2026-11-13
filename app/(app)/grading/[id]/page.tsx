import Link from 'next/link'
import { notFound } from 'next/navigation'
import { can, need } from '@/lib/me'
import { grade } from '../../../actions'
import { Submit } from '@/components/Submit'
import { fTime } from '@/lib/util'

export default async function GradeOne({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sb } = await need((me) => can(me, 'grade'))
  const { data } = await sb
    .from('submissions')
    .select('id, status, created_at, photo_path, student:profiles(full_name), assignment:assignments(title, questions), grades(correct, wrong, note)')
    .eq('id', id)
    .maybeSingle()
  if (!data) notFound()
  const x = data as unknown as {
    id: string; status: string; created_at: string; photo_path: string
    student: { full_name: string }; assignment: { title: string; questions: number }
    grades: { correct: number; wrong: number; note: string } | null
  }
  const { data: signed } = await sb.storage.from('solutions').createSignedUrl(x.photo_path, 3600)
  const g = x.grades

  return (
    <>
      <Link className="link back" href="/grading">→ رجوع لقائمة الحلول</Link>
      <div className="grade">
        <figure className="photo">
          {signed ? <img src={signed.signedUrl} alt={'صورة حل ' + x.student.full_name} /> : <p className="muted">الصورة مش موجودة.</p>}
        </figure>
        <form action={grade} className="panel form" key={x.id}>
          <input type="hidden" name="id" value={x.id} />
          <div className="row">
            <div>
              <h2>{x.student.full_name}</h2>
              <div className="muted small">{x.assignment.title} · {x.assignment.questions} سؤال · اتبعت {fTime(x.created_at)}</div>
            </div>
            {g && <div className="result">{g.correct}<small>من {g.correct + g.wrong}</small></div>}
          </div>
          <div className="two">
            <label className="fld"><span>✓ صح</span><input id="correct" name="correct" type="number" inputMode="numeric" min={0} max={x.assignment.questions} defaultValue={g?.correct} required /></label>
            <label className="fld"><span>✗ غلط</span><input id="wrong" name="wrong" type="number" inputMode="numeric" min={0} max={x.assignment.questions} defaultValue={g?.wrong} required /></label>
          </div>
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
