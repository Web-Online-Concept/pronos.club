// src/app/[locale]/(public)/coupe-du-monde/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coupe du Monde 2026 — Groupes, Calendrier, Classements & Bracket | PRONOS.CLUB",
  description:
    "Suivez la Coupe du Monde FIFA 2026 : 48 équipes, 12 groupes, calendrier des 104 matchs, classements live, tableau éliminatoire. USA, Canada, Mexique — 11 juin au 19 juillet 2026.",
  keywords: [
    "coupe du monde 2026",
    "world cup 2026",
    "groupes coupe du monde",
    "calendrier coupe du monde 2026",
    "classement coupe du monde",
    "bracket world cup",
    "FIFA 2026",
    "pronos coupe du monde",
    "paris sportifs coupe du monde",
  ],
  openGraph: {
    title: "Coupe du Monde FIFA 2026 — PRONOS.CLUB",
    description:
      "48 équipes · 12 groupes · 104 matchs · Classements live & Bracket. Tout sur la Coupe du Monde 2026.",
    type: "website",
    url: "https://pronos.club/fr/coupe-du-monde",
    siteName: "PRONOS.CLUB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Coupe du Monde FIFA 2026 — PRONOS.CLUB",
    description:
      "Groupes, calendrier, classements et bracket de la Coupe du Monde 2026. Suivez tout en direct.",
  },
  alternates: {
    canonical: "https://pronos.club/fr/coupe-du-monde",
    languages: {
      fr: "https://pronos.club/fr/coupe-du-monde",
      en: "https://pronos.club/en/coupe-du-monde",
      es: "https://pronos.club/es/coupe-du-monde",
    },
  },
};

export default function WorldCupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}