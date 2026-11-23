import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Keeps the login session fresh and sends signed-out visitors to the login page.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  // getClaims checks the login's signature here instead of asking Supabase's auth server on every click.
  const { data } = await sb.auth.getClaims()
  const user = data?.claims.sub
  const open = ['/login', '/setup'].some((p) => request.nextUrl.pathname.startsWith(p))
  if (!user && !open) return NextResponse.redirect(new URL('/login', request.url))
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:png|svg|jpg|webp)$).*)'],
}
