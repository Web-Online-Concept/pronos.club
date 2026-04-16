import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculateur TRJ | PRONOS.CLUB",
  description:
    "Calculateur TRJ (Taux de Retour Joueur) PRONOS.CLUB : analysez la qualité du bookmaker sur 2 ou 3 options. Échelle de référence et comparateur entre marchés inclus.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  openGraph: {
    title: "Calculateur TRJ | PRONOS.CLUB",
    description: "Calculateur TRJ pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function TRJLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}