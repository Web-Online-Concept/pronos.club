// src/components/o05/MatchAnalysisCard.tsx
//
// Carte de presentation d'un match analyse.
// Affiche : verdict colorise + nom equipes + score + bouton "Detail".

"use client";

import Link from "next/link";

type MatchCardProps = {
  matchId: string;
  matchDate: string;       // ISO
  homeTeamName: string;
  awayTeamName: string;
  targetTeamName: string;
  targetRole: "home" | "away";
  attackScore: number | null;
  defenseScore: number | null;
  totalScore: number | null;
  note10: number | null;
  verdict: "TRÈS BON" | "BON" | "MOYEN" | "FAIBLE" | null;
  dataQuality: "complete" | "partial" | "missing" | null;
  errorMessage: string | null;
  analysisId: string;
  locale: string;
};

const VERDICT_STYLES: Record<
  "TRÈS BON" | "BON" | "MOYEN" | "FAIBLE",
  { bg: string; text: string; emoji: string }
> = {
  "TRÈS BON": {
    bg: "bg-emerald-500/20 border-emerald-500/40",
    text: "text-emerald-300",
    emoji: "🟢",
  },
  "BON": {
    bg: "bg-yellow-500/20 border-yellow-500/40",
    text: "text-yellow-300",
    emoji: "🟡",
  },
  "MOYEN": {
    bg: "bg-orange-500/20 border-orange-500/40",
    text: "text-orange-300",
    emoji: "🟠",
  },
  "FAIBLE": {
    bg: "bg-red-500/20 border-red-500/40",
    text: "text-red-300",
    emoji: "🔴",
  },
};


export default function MatchAnalysisCard(props: MatchCardProps) {
  const {
    matchId,
    matchDate,
    homeTeamName,
    awayTeamName,
    targetTeamName,
    targetRole,
    attackScore,
    defenseScore,
    note10,
    verdict,
    dataQuality,
    errorMessage,
    analysisId,
    locale,
  } = props;

  // Cas erreur : carte grise avec message
  if (errorMessage || !verdict) {
    return (
      <div
        className="overflow-hidden rounded-xl border border-white/[0.06] p-5"
        style={{ background: "linear-gradient(135deg, #111111 0%, #1a1a1a 100%)" }}
      >
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>{formatDate(matchDate)}</span>
          <span>⚠️ Erreur</span>
        </div>
        <p className="mt-2 font-bold text-white">
          {homeTeamName} <span className="text-white/40">vs</span> {awayTeamName}
        </p>
        <p className="mt-2 text-xs text-red-400/80">{errorMessage}</p>
      </div>
    );
  }

  const styles = VERDICT_STYLES[verdict];

  return (
    <Link
      href={`/${locale}/espace/over-05-buts-equipes/${analysisId}/${matchId}`}
      className="group block overflow-hidden rounded-xl border border-white/[0.06] p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      {/* Date + qualité */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{formatDate(matchDate)}</span>
        {dataQuality === "partial" && (
          <span
            className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-300"
            title="Certaines données manquent"
          >
            ⚠️ Partielles
          </span>
        )}
      </div>

      {/* Verdict + Note */}
      <div className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 ${styles.bg}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{styles.emoji}</span>
          <span className={`text-sm font-black ${styles.text}`}>{verdict}</span>
        </div>
        <span className={`text-2xl font-black ${styles.text}`}>
          {note10?.toFixed(1)}<span className="text-sm font-normal opacity-60">/10</span>
        </span>
      </div>

      {/* Équipes */}
      <div className="mt-4">
        <p className="text-xs uppercase tracking-wider text-emerald-400/80">
          🎯 Cible : <span className="font-bold">{targetTeamName}</span>
        </p>
        <p className="mt-1 font-bold text-white">
          <span className={targetRole === "home" ? "text-emerald-400" : "text-white"}>
            {homeTeamName}
          </span>
          <span className="mx-2 text-white/40">vs</span>
          <span className={targetRole === "away" ? "text-emerald-400" : "text-white"}>
            {awayTeamName}
          </span>
        </p>
        <p className="mt-1 text-xs text-white/40">
          {targetRole === "home" ? "🏠 à domicile" : "✈️ à l'extérieur"}
        </p>
      </div>

      {/* Détail rapide */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-white/5 p-2">
          <p className="text-white/40">Attaque</p>
          <p className="font-bold text-white">{attackScore?.toFixed(1) ?? "-"}<span className="text-white/40">/8</span></p>
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <p className="text-white/40">Défense</p>
          <p className="font-bold text-white">{defenseScore?.toFixed(1) ?? "-"}<span className="text-white/40">/8</span></p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 p-2">
          <p className="text-emerald-400/60">Note</p>
          <p className="font-bold text-emerald-300">{note10?.toFixed(1)}<span className="text-emerald-400/60">/10</span></p>
        </div>
      </div>

      {/* Bouton détail */}
      <div className="mt-4 text-center">
        <span className="inline-block rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold text-emerald-300 transition group-hover:bg-emerald-500/20">
          Voir le détail →
        </span>
      </div>
    </Link>
  );
}


function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}