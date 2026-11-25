import type { NextConfig } from 'next'

const config: NextConfig = {
  // The first-run setup screen hands this file over to paste into Supabase.
  outputFileTracingIncludes: { '/**': ['./supabase/install.sql'] },
  // Students' names, numbers and grades: nothing here should be framed by another site or leak in a referrer.
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    },
  ],
}

export default config
