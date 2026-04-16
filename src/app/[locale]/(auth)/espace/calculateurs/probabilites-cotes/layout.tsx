import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Probabilités des cotes | PRONOS.CLUB",
  description:
    "Calculateur de probabilités des cotes PRONOS.CLUB : convertissez vos cotes en probabilités implicites et réelles. Analysez le TRJ et la marge bookmaker sur 2 ou 3 options.",
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
    title: "Probabilités des cotes | PRONOS.CLUB",
    description: "Convertisseur cote ↔ probabilité pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function ProbabilitesCotesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}