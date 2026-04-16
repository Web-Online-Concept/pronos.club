import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bénéfice à acquérir | PRONOS.CLUB",
  description:
    "Calculateur de mise inverse PRONOS.CLUB : fixez votre gain cible et obtenez la mise exacte à placer selon la cote. Idéal pour atteindre un objectif précis ou débloquer un bonus.",
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
    title: "Bénéfice à acquérir | PRONOS.CLUB",
    description: "Calculateur gain cible → mise pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function BeneficeAcquerirLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}