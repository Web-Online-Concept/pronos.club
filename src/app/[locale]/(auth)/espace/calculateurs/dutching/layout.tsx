import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dutching Calculator | PRONOS.CLUB",
  description:
    "Calculateur de Dutching PRONOS.CLUB : répartissez votre mise sur 2 à 8 issues pour obtenir un gain identique peu importe laquelle gagne. Modes mise totale et gain cible.",
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
    title: "Dutching Calculator | PRONOS.CLUB",
    description: "Calculateur de Dutching pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function DutchingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}