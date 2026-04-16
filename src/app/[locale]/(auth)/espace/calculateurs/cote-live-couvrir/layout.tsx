import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cote live pour couvrir | PRONOS.CLUB",
  description:
    "Calculateur de hedging live PRONOS.CLUB : couvrez votre pari pré-match avec une mise live pour sécuriser un profit ou réduire la perte. 2 modes : équilibré ou profit garanti.",
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
    title: "Cote live pour couvrir | PRONOS.CLUB",
    description: "Calculateur de hedging live pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function CoteLiveCouvrirLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}