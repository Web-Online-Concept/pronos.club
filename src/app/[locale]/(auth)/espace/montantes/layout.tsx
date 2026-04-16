import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Montantes | PRONOS.CLUB",
  description: "Gestionnaire de montantes PRONOS.CLUB : créez, suivez et analysez vos stratégies de progression de mises. Bankroll dédiée, paliers illimités, mode objectif ou libre.",
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
    title: "Montantes | PRONOS.CLUB",
    description: "Gestionnaire de montantes pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function MontantesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}