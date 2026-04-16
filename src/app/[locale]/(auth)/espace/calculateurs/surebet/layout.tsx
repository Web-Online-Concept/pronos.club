import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Surebet Calculator (Arbitrage) | PRONOS.CLUB",
  description:
    "Calculateur de Surebet (arbitrage) PRONOS.CLUB : détectez les arbitrages mathématiques entre 2 ou 3 bookmakers pour un profit garanti. Modes mise totale et gain cible.",
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
    title: "Surebet Calculator | PRONOS.CLUB",
    description: "Calculateur de Surebet pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function SurebetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}