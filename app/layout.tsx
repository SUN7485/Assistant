import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import { Flash } from '@/components/Flash'
import './globals.css'

export const metadata: Metadata = {
  title: 'مساعد المدرس',
  description: 'الحضور والغياب، تصحيح الحلول، والاشتراكات للسنتر',
  appleWebApp: { capable: true, title: 'مساعد المدرس', statusBarStyle: 'black-translucent' },
}
export const viewport: Viewport = { themeColor: '#1d5a4a', viewportFit: 'cover', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Readex+Pro:wght@500;700&display=swap"
        />
      </head>
      <body>
        {children}
        <Suspense>
          <Flash />
        </Suspense>
      </body>
    </html>
  )
}
