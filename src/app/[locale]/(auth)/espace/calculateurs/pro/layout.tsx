import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculateur Pro | PRONOS.CLUB",
  description:
    "Calculateur Pro PRONOS.CLUB : surebets, matched betting, freebets, dutching, trading same-book, multi-devises. L'outil tout-en-un pour les parieurs pros.",
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
    title: "Calculateur Pro | PRONOS.CLUB",
    description: "Calculateur tout-en-un pour les membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function CalculatorProLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}