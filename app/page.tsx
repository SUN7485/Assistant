import { redirect } from 'next/navigation'
import { getMe } from '@/lib/me'

export default async function Start() {
  const { me } = await getMe()
  if (me.role === 'admin') redirect('/home')
  if (me.role === 'teacher') redirect(me.can_grade ? '/grading' : '/groups')
  redirect('/upload')
}
