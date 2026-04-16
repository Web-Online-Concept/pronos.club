import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculateur ROI % | PRONOS.CLUB",
  description:
    "Calculateur de ROI PRONOS.CLUB : mesurez le rendement de vos paris avec une échelle de référence (Excellent, Bon, Rentable, Juste, Perdant). La vraie métrique de performance.",
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
    title: "Calculateur ROI % | PRONOS.CLUB",
    description: "Calculateur ROI pour membres premium PRONOS.CLUB",
    type: "website",
  },
};

export default function ROILayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}