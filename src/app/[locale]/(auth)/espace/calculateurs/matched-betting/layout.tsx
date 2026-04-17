import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculateur Matched Betting | PRONOS.CLUB",
  description:
    "Calculez la mise Lay idéale et le profit garanti d'un bonus bookmaker (pari de qualification ou freebet SNR/SR). Support Back/Lay, commissions exchange, ROI automatique.",
};

export default function MatchedBettingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}