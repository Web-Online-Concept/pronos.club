import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Value Bet Calculator | PRONOS.CLUB",
  description:
    "Calculateur de Value Bet PRONOS.CLUB : détectez les value bets en comparant vos cotes à Pinnacle/PS3838. TRJ, Fair Odds, EV calculés automatiquement pour 8 types de marchés.",
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
    title: "Value Bet Calculator | PRONOS.CLUB",
    description: "Calculateur de Value Bet pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function ValueBetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}