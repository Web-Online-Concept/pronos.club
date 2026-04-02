import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Analytics } from './components/Analytics'

/** Metadata globale Valora */
export const metadata: Metadata = {
  title: {
    default: 'Valora — Clarification, preuve et transmission pour décisions sensibles',
    template: '%s | Valora',
  },
  description: 'Valora aide à clarifier une décision, un dossier ou un processus sensible sans remplacer votre manière de fonctionner.',
  metadataBase: new URL('https://my-valora.com'),
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'Valora',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#2C2418',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

/**
 * Layout racine pour toutes les pages localisées.
 * 
 * Usage : app/[locale]/layout.tsx
 * 
 * Inclut :
 * - Google Analytics (conditionnel NEXT_PUBLIC_GA_ID)
 * - Meta globales (OG, Twitter, manifest, icons)
 * - Font Georgia via system
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()
  return (
    <html lang={locale} style={{ scrollBehavior: 'smooth' }}>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: 'Georgia, "Times New Roman", serif',
        background: '#F5F0EA',
        color: '#2C2418',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}>
        <NextIntlClientProvider messages={messages}>
          <Analytics />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}