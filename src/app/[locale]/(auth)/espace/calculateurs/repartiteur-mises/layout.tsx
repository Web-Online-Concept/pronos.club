import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Répartiteur de mises | PRONOS.CLUB",
  description:
    "Calculateur de couverture de pari PRONOS.CLUB : exploitez vos paris remboursés (freebets, bonus) ou sécurisez un pari simple avec une Double Chance pour garantir un profit ou limiter la perte.",
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
    title: "Répartiteur de mises | PRONOS.CLUB",
    description: "Répartiteur de mises pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function RepartiteurMisesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}