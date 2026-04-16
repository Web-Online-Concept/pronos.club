import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mise % du capital (Kelly) | PRONOS.CLUB",
  description:
    "Calculateur de mise optimale PRONOS.CLUB : 2 modes — Flat Betting (% fixe) ou Kelly Criterion (Full/Half/Quarter). Trouvez la mise idéale selon votre bankroll et votre stratégie.",
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
    title: "Mise % du capital (Kelly) | PRONOS.CLUB",
    description: "Calculateur Flat Betting + Kelly pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function KellyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}