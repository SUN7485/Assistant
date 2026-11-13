import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'مساعد المدرس',
    short_name: 'مساعد المدرس',
    start_url: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#f2f5f3',
    theme_color: '#1d5a4a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
