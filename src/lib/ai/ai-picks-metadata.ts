/**
 * ═══════════════════════════════════════════════════════════════════
 * HELPER — buildPronosIAMetadata
 * ═══════════════════════════════════════════════════════════════════
 *
 * Construit les metadata complètes pour toutes les pages Pronos IA :
 *   - Title / Description
 *   - Canonical URL
 *   - Hreflang (FR / EN / ES)
 *   - Open Graph (image, titre, description, url, type, locale)
 *   - Twitter Cards (summary_large_image)
 *   - Robots
 *
 * Centralise la logique pour éviter la duplication dans les 4 pages.
 * ═══════════════════════════════════════════════════════════════════
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

const BASE_URL = "https://pronos.club";
// V3.5 Lot 12 — OG image dynamique générée par /api/og/default (route Next.js)
// au lieu d'une image statique. Permet de versionner facilement le visuel.
const OG_IMAGE = "/api/og/default";
const OG_IMAGE_ALT_KEY = "meta_og_image_alt";

const SUPPORTED_LOCALES = ["fr", "en", "es"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

// Mapping locale -> Open Graph locale code
const OG_LOCALE_MAP: Record<Locale, string> = {
  fr: "fr_FR",
  en: "en_US",
  es: "es_ES",
};

export type PronosIAPageKey =
  | "live"
  | "stats"
  | "history"
  | "howitworks";

// Chemins des pages (identiques dans les 3 langues grâce à next-intl)
const PAGE_PATHS: Record<PronosIAPageKey, string> = {
  live: "/pronos-ia",
  stats: "/pronos-ia/stats",
  history: "/pronos-ia/historique",
  howitworks: "/pronos-ia/comment-ca-marche",
};


/**
 * Construit les metadata complètes pour une page Pronos IA.
 *
 * @param locale - Langue courante (fr / en / es)
 * @param page - Clé identifiant la page (live / stats / history / howitworks)
 */
export async function buildPronosIAMetadata(
  locale: string,
  page: PronosIAPageKey,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  // Clés de traduction dépendantes de la page
  const titleKey = {
    live: "meta_title",
    stats: "stats_meta_title",
    history: "history_meta_title",
    howitworks: "howitworks_meta_title",
  }[page];

  const descKey = {
    live: "meta_description",
    stats: "stats_meta_description",
    history: "history_meta_description",
    howitworks: "howitworks_meta_description",
  }[page];

  const title = t(titleKey);
  const description = t(descKey);
  const imageAlt = t(OG_IMAGE_ALT_KEY);

  const path = PAGE_PATHS[page];
  const canonicalUrl = `${BASE_URL}/${locale}${path}`;

  // Hreflang : référence toutes les versions traduites de la page
  const hreflangMap: Record<string, string> = {};
  for (const loc of SUPPORTED_LOCALES) {
    hreflangMap[loc] = `${BASE_URL}/${loc}${path}`;
  }
  // x-default pointe vers la version FR (principale)
  hreflangMap["x-default"] = `${BASE_URL}/fr${path}`;

  const ogLocale = OG_LOCALE_MAP[locale as Locale] ?? "fr_FR";
  const ogLocaleAlternates = SUPPORTED_LOCALES.filter(
    (l) => l !== locale,
  ).map((l) => OG_LOCALE_MAP[l]);

  return {
    title,
    description,
    metadataBase: new URL(BASE_URL),

    // Robots
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },

    // Canonical + hreflang
    alternates: {
      canonical: canonicalUrl,
      languages: hreflangMap,
    },

    // Open Graph
    openGraph: {
      type: "website",
      siteName: "PRONOS.CLUB",
      title,
      description,
      url: canonicalUrl,
      locale: ogLocale,
      alternateLocale: ogLocaleAlternates,
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: imageAlt,
          type: "image/png",
        },
      ],
    },

    // Twitter Cards
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },

    // Verification tags (optionnel, à compléter si besoin)
    // verification: { google: "..." },

    // Catégorie
    category: "sports",
  };
}