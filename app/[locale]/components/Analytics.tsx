import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

/**
 * Composant Google Analytics.
 * Ajouter dans app/[locale]/layout.tsx :
 *   import { Analytics } from '@/components/Analytics'
 *   puis <Analytics /> dans le <body>
 *
 * Env var requise : NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
 * Search Console : vérification via GA (pas de code supplémentaire).
 */
export function Analytics() {
  if (!GA_ID) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            page_path: window.location.pathname,
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  )
}