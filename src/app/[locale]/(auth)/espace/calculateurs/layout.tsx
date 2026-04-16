import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculateurs Paris Sportifs | PRONOS.CLUB",
  description:
    "Boîte à outils Premium PRONOS.CLUB : 10 calculateurs pour paris sportifs — Value Bet, Dutching, Surebet, Kelly, ROI, TRJ et plus.",
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
    title: "Calculateurs Paris Sportifs | PRONOS.CLUB",
    description: "10 calculateurs pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function CalculateursLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}