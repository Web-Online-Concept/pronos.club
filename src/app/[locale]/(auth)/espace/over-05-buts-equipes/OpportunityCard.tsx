"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

type OpportunityCardProps = {
  opportunity: {
    id: string;
    match_date: string;
    home_team_name: string;
    away_team_name: string;
    target_team_name: string;
    target_role: "home" | "away";
    opponent_team_name: string;
    stake_score: number;
    stake_situations: Array<{ type: string; detail: string; gap_points: number }>;
    target_intrinsic: number;
    opponent_intrinsic: number;
    target_form_score: number;
    opponent_fragility_score: number;
    total_score: number;
    badge: "green" | "orange" | "red";
    bertrand_decision: "play" | "skip" | "pending" | null;
    o05_leagues: {
      name: string;
      country: string;
    } | null;
  };
};

const BADGE_HEADER: Record<string, { bg: string; label: string }> = {
  green: { bg: "bg-emerald-500", label: "🟢 VERT" },
  orange: { bg: "bg-amber-500", label: "🟠 ORANGE" },
  red: { bg: "bg-red-500", label: "🔴 ROUGE" },
};

const BADGE_BORDER: Record<string, string> = {
  green: "border-emerald-200",
  orange: "border-amber-200",
  red: "border-red-200",
};

const STAKE_TYPE_LABEL: Record<string, string> = {
  title: "🏆 Lutte titre",
  europe: "🏅 Course Europe",
  relegation: "⚠️ Relégation",
};

const DECISION_BADGE: Record<string, { color: string; label: string }> = {
  play: { color: "bg-emerald-100 text-emerald-700 border-emerald-300", label: "✓ Joué" },
  skip: { color: "bg-neutral-100 text-neutral-600 border-neutral-300", label: "✗ Passé" },
  pending: { color: "bg-amber-100 text-amber-700 border-amber-300", label: "⏳ En attente" },
};


export default function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const locale = useLocale();
  const matchDate = new Date(opportunity.match_date);
  const badgeStyle = BADGE_HEADER[opportunity.badge];
  const decision = opportunity.bertrand_decision || "pending";
  const decisionStyle = DECISION_BADGE[decision];

  const targetIsHome = opportunity.target_role === "home";

  return (
    <div
      className={`overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${BADGE_BORDER[opportunity.badge]}`}
    >
      {/* Header avec badge couleur */}
      <div className={`${badgeStyle.bg} px-4 py-2 flex items-center justify-between`}>
        <span className="text-xs font-black text-white">{badgeStyle.label}</span>
        <span className="text-2xl font-black text-white">
          {opportunity.total_score} pts
        </span>
      </div>

      {/* Match */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            {opportunity.o05_leagues?.name ?? "Championnat"} ·{" "}
            {matchDate.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <h3 className="mt-1 text-base font-black text-neutral-900">
            <span className={targetIsHome ? "text-emerald-600" : "text-neutral-900"}>
              {opportunity.home_team_name}
            </span>
            <span className="mx-2 text-neutral-400">vs</span>
            <span className={!targetIsHome ? "text-emerald-600" : "text-neutral-900"}>
              {opportunity.away_team_name}
            </span>
          </h3>
        </div>

        {/* Cible */}
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            🎯 Cible (favori intrinsèque)
          </p>
          <p className="mt-1 text-sm font-bold text-neutral-900">
            {opportunity.target_team_name}
            <span className="ml-2 text-xs font-normal text-neutral-500">
              {targetIsHome ? "à domicile" : "à l'extérieur"}
            </span>
          </p>
        </div>

        {/* Enjeu */}
        {opportunity.stake_situations.length > 0 && (
          <div className="space-y-1">
            {opportunity.stake_situations.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-neutral-700">
                <span className="font-bold flex-shrink-0">{STAKE_TYPE_LABEL[s.type] ?? s.type}</span>
                <span className="text-neutral-400">·</span>
                <span className="flex-1">{s.detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* Stats clés */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider text-neutral-400">Forme favori</p>
            <p className="mt-0.5 text-sm font-bold text-emerald-600">
              {opportunity.target_form_score}/20
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider text-neutral-400">Fragilité out.</p>
            <p className="mt-0.5 text-sm font-bold text-amber-600">
              {opportunity.opponent_fragility_score}/20
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider text-neutral-400">Niveaux</p>
            <p className="mt-0.5 text-xs font-bold text-neutral-700">
              {Number(opportunity.target_intrinsic).toFixed(2)}{" "}
              <span className="text-neutral-400">vs</span>{" "}
              {Number(opportunity.opponent_intrinsic).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Footer : décision + lien */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
          <span
            className={`${decisionStyle.color} text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border`}
          >
            {decisionStyle.label}
          </span>
          <Link
            href={`/${locale}/espace/over-05-buts-equipes/${opportunity.id}`}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition"
          >
            Voir détail →
          </Link>
        </div>
      </div>
    </div>
  );
}