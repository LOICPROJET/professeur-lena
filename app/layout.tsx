import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Professeur Léna',
  description: "Ton aide aux devoirs bienveillante 📚",
  manifest: '/manifest.json',

  // ── PWA / iPhone home screen ────────────────────────────────────────────────
  appleWebApp: {
    capable: true,
    title: 'Léna',
    statusBarStyle: 'default',
    startupImage: [
      // iPhone 14 Pro Max
      { url: '/apple-touch-icon.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
      // iPhone 14 / 13 / 12
      { url: '/apple-touch-icon.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
    ],
  },

  // ── Icons ────────────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon-192.png',
  },

  // ── Open Graph (for sharing the Vercel link) ─────────────────────────────────
  openGraph: {
    title: 'Professeur Léna',
    description: "L'application qui corrige les devoirs de Léna avec bienveillance 👧📚",
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#A78BFA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* iPhone standalone mode — hides Safari chrome when launched from home screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="bg-[#F9FAF8] min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
