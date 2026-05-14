"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useO05AnalysisPolling } from "@/hooks/useO05AnalysisPolling";
import MatchAnalysisCard from "@/components/o05/MatchAnalysisCard";
import AnalysisProgressBar from "@/components/o05/AnalysisProgressBar";

type Verdict = "TRÈS BON" | "BON" | "MOYEN" | "FAIBLE";

type Filter = "all" | Verdict;

export default function AnalysisResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const locale = useLocale();

  const { data, error, loading } = useO05AnalysisPolling(id);

  const [filter, setFilter] = useState<Filter>("all");

  // Filtrage des matchs
  const filteredMatches = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.match_analyses;
    return data.match_analyses.filter((m) => m.verdict === filter);
  }, [data, filter]);

  // ─── Loading initial ───
  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-3 text-sm text-neutral-600">Chargement...</p>
        </div>
      </main>
    );
  }

  // ─── Erreur ───
  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <BackLink locale={locale} />
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-6 text-center">
          <h2 className="text-base font-black text-red-600">❌ Erreur</h2>
          <p className="mt-2 text-sm text-red-500">{error ?? "Analyse introuvable"}</p>
        </div>
      </main>
    );
  }

  const { analysis, match_analyses } = data;
  const isRunning =
    analysis.status === "pending" || analysis.status === "running";

  // Compteurs par verdict
  const verdictCounts: Record<Verdict, number> = {
    "TRÈS BON": 0,
    "BON": 0,
    "MOYEN": 0,
    "FAIBLE": 0,
  };
  for (const m of match_analyses) {
    if (m.verdict) verdictCounts[m.verdict]++;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <BackLink locale={locale} />

      {/* Header */}
      <div className="mt-6">
        <h1 className="text-2xl font-black tracking-tight text-neutral-900">
          📊 {analysis.matchday_label ?? "Analyse"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Période : {formatDateRange(analysis.date_from, analysis.date_to)} ·
          Lancée le {formatDate(analysis.created_at)}
        </p>
      </div>

      {/* Barre de progression ou résumé */}
      {isRunning || analysis.status === "failed" ? (
        <div className="mt-6">
          <AnalysisProgressBar
            status={analysis.status}
            matchesAnalyzed={analysis.matches_analyzed}
            matchesFailed={analysis.matches_failed}
            totalMatches={analysis.total_matches}
            errorMessage={analysis.error_message}
            createdAt={analysis.created_at}
          />
        </div>
      ) : (
        <div
          className="mt-6 overflow-hidden rounded-xl border border-white/[0.06] p-5"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <h2 className="text-base font-black text-white">
            ✅ Analyse terminée
          </h2>
          <p className="mt-2 text-sm text-white/70">
            <span className="text-2xl font-black text-emerald-400">
              {analysis.matches_analyzed}
            </span>{" "}
            matchs analysés
            {analysis.matches_failed > 0 && (
              <span className="ml-2 text-yellow-300">
                ({analysis.matches_failed} en erreur)
              </span>
            )}
          </p>

          {/* Compteurs par verdict */}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            <VerdictBadge label="TRÈS BON" count={verdictCounts["TRÈS BON"]} color="emerald" />
            <VerdictBadge label="BON" count={verdictCounts["BON"]} color="yellow" />
            <VerdictBadge label="MOYEN" count={verdictCounts["MOYEN"]} color="orange" />
            <VerdictBadge label="FAIBLE" count={verdictCounts["FAIBLE"]} color="red" />
          </div>
        </div>
      )}

      {/* Filtres */}
      {!isRunning && match_analyses.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Filtrer :
          </span>
          <FilterButton
            label="🔵 Tout"
            count={match_analyses.length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterButton
            label="🟢 Très bon"
            count={verdictCounts["TRÈS BON"]}
            active={filter === "TRÈS BON"}
            onClick={() => setFilter("TRÈS BON")}
          />
          <FilterButton
            label="🟡 Bon"
            count={verdictCounts["BON"]}
            active={filter === "BON"}
            onClick={() => setFilter("BON")}
          />
          <FilterButton
            label="🟠 Moyen"
            count={verdictCounts["MOYEN"]}
            active={filter === "MOYEN"}
            onClick={() => setFilter("MOYEN")}
          />
          <FilterButton
            label="🔴 Faible"
            count={verdictCounts["FAIBLE"]}
            active={filter === "FAIBLE"}
            onClick={() => setFilter("FAIBLE")}
          />
        </div>
      )}

      {/* Liste des matchs */}
      {filteredMatches.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filteredMatches.map((m) => (
            <MatchAnalysisCard
              key={m.id}
              matchId={m.id}
              matchDate={m.match_date}
              homeTeamName={m.home_team?.name ?? "—"}
              awayTeamName={m.away_team?.name ?? "—"}
              targetTeamName={m.target_team?.name ?? "—"}
              targetRole={m.target_role}
              attackScore={m.attack_score}
              defenseScore={m.defense_score}
              totalScore={m.total_score}
              note10={m.note_10}
              verdict={m.verdict}
              dataQuality={m.data_quality}
              errorMessage={m.error_message}
              analysisId={analysis.id}
              locale={locale}
            />
          ))}
        </div>
      )}

      {!isRunning && filteredMatches.length === 0 && match_analyses.length > 0 && (
        <p className="mt-6 text-center text-sm text-neutral-500">
          Aucun match ne correspond à ce filtre.
        </p>
      )}

      {!isRunning && match_analyses.length === 0 && (
        <p className="mt-6 text-center text-sm text-neutral-500">
          Aucun match analysé sur cette période.
        </p>
      )}
    </main>
  );
}


// ─── Composants UI ───────────────────────────────────────────────

function BackLink({ locale }: { locale: string }) {
  return (
    <Link
      href={`/${locale}/espace/over-05-buts-equipes`}
      className="inline-flex items-center gap-2 text-sm text-neutral-600 transition hover:text-neutral-900"
    >
      ← Nouvelle analyse
    </Link>
  );
}

function VerdictBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "emerald" | "yellow" | "orange" | "red";
}) {
  const colorClasses: Record<string, string> = {
    emerald: "bg-emerald-500/20 text-emerald-300",
    yellow: "bg-yellow-500/20 text-yellow-300",
    orange: "bg-orange-500/20 text-orange-300",
    red: "bg-red-500/20 text-red-300",
  };
  return (
    <div className={`rounded-lg p-2 ${colorClasses[color]}`}>
      <p className="text-2xl font-black">{count}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
        active
          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
          : "border-neutral-300 text-neutral-600 hover:border-neutral-400"
      }`}
    >
      {label} <span className="opacity-60">({count})</span>
    </button>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────

function formatDateRange(from: string, to: string): string {
  const fmt = (d: string) => {
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };
  return from === to ? fmt(from) : `${fmt(from)} → ${fmt(to)}`;
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