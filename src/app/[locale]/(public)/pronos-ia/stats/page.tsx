/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/stats (VERSION FINALE)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Stats détaillées des Pronos IA.
 *
 * Blocs :
 *   1. Vue d'ensemble Classiques
 *   2. Simulation 1U
 *   3. Vue d'ensemble Buteurs
 *   4. Classiques par sport (3 mini-cards)
 *   5. Buteurs par ligue (mini-cards)
 *   6. Analyse de la confidence IA
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Sparkles } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  ClassicStatsRow,
  ScorerStatsRow,
} from "@/lib/ai/ai-stats-types";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import AIStatsOverview from "@/components/ai-picks/stats/AIStatsOverview";
import AISimulationBlock from "@/components/ai-picks/stats/AISimulationBlock";
import AIStatsBySport from "@/components/ai-picks/stats/AIStatsBySport";
import AIStatsByLeague from "@/components/ai-picks/stats/AIStatsByLeague";
import AIConfidenceAnalysis from "@/components/ai-picks/stats/AIConfidenceAnalysis";
import PronosIAButton from "@/components/ai-picks/ui/PronosIAButton";

export const revalidate = 600;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return {
    title: t("stats_meta_title"),
    description: t("stats_meta_description"),
    robots: { index: true, follow: true },
  };
}


// ═══════════════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════════════

const getStats = unstable_cache(
  async () => {
    const [classicsResult, scorersResult] = await Promise.all([
      supabaseAdmin.from("ai_stats_classic").select("*"),
      supabaseAdmin.from("ai_stats_scorer").select("*"),
    ]);

    if (classicsResult.error) {
      console.error("[stats] Erreur ai_stats_classic:", classicsResult.error);
    }
    if (scorersResult.error) {
      console.error("[stats] Erreur ai_stats_scorer:", scorersResult.error);
    }

    return {
      classics: (classicsResult.data ?? []) as ClassicStatsRow[],
      scorers: (scorersResult.data ?? []) as ScorerStatsRow[],
    };
  },
  ["ai-stats-enriched"],
  { revalidate: 600, tags: ["ai-stats-enriched"] },
);


const getFirstPickDate = unstable_cache(
  async (): Promise<string | null> => {
    const { data, error } = await supabaseAdmin
      .from("ai_picks")
      .select("generation_batch")
      .in("status", ["won", "lost", "void"])
      .order("generation_batch", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data.generation_batch as string;
  },
  ["ai-first-pick-date"],
  { revalidate: 3600, tags: ["ai-first-pick-date"] },
);


// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

export default async function StatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const [{ classics, scorers }, firstPickDate] = await Promise.all([
    getStats(),
    getFirstPickDate(),
  ]);

  // Totaux globaux (ligne où sport IS NULL et league IS NULL)
  const classicsTotal = classics.find(
    (r) => r.sport === null && r.league === null,
  );
  const scorersTotal = scorers.find((r) => r.league === null);

  // Classiques par sport (sport != null, league == null)
  const classicsBySport = classics.filter(
    (r) => r.sport !== null && r.league === null,
  );

  // Buteurs par ligue (league != null)
  const scorersByLeague = scorers.filter((r) => r.league !== null);

  const totalResolvedClassics = classicsTotal?.total_resolved ?? 0;
  const totalResolvedScorers = scorersTotal?.total_resolved ?? 0;
  const totalResolved = totalResolvedClassics + totalResolvedScorers;

  const localeMap: Record<string, string> = {
    fr: "fr-FR",
    en: "en-US",
    es: "es-ES",
  };
  const dateLocale = localeMap[locale] ?? "fr-FR";

  const firstDateFormatted = firstPickDate
    ? new Date(firstPickDate).toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Paris",
      })
    : null;

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">
      <div className="relative">
        {/* Halo violet décoratif en haut */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[400px] opacity-[0.05]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, #8b5cf6 0%, transparent 60%)",
          }}
        />

        <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

          {/* ═══ BACK LINK ═══ */}
          <div className="mb-6">
            <PronosIAButton
              href={`/${locale}/pronos-ia`}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              {t("link_back_to_picks")}
            </PronosIAButton>
          </div>

          {/* ═══ HERO ═══ */}
          <header className="mb-10 text-center">
            {/* Badge */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700">
              <Sparkles size={12} strokeWidth={2.5} className="text-violet-500" />
              {t("stats_badge")}
            </div>

            <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #a855f7 100%)",
                }}
              >
                {t("stats_page_title")}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-base text-neutral-600 sm:text-lg">
              {firstDateFormatted
                ? t("stats_page_subtitle_since", { date: firstDateFormatted })
                : t("stats_page_subtitle_generic")}
            </p>
          </header>

          {/* ═══ CONTENU ═══ */}
          {totalResolved === 0 ? (
            <EmptyStats locale={locale} />
          ) : (
            <div className="space-y-8">

              {/* BLOC 1 — Vue d'ensemble Classiques */}
              {classicsTotal && classicsTotal.total_resolved > 0 && (
                <AIStatsOverview
                  title={t("stats_classics_title")}
                  subtitle={t("stats_classics_subtitle")}
                  accent="violet"
                  wins={classicsTotal.wins}
                  losses={classicsTotal.losses}
                  winRate={classicsTotal.win_rate_pct}
                  avgOdds={classicsTotal.avg_odds}
                  avgOddsWon={classicsTotal.avg_odds_won}
                  avgOddsLost={classicsTotal.avg_odds_lost}
                  locale={locale}
                />
              )}

              {/* BLOC 2 — Simulation 1U */}
              {classicsTotal && classicsTotal.simulation_stake > 0 && (
                <AISimulationBlock
                  stake={classicsTotal.simulation_stake}
                  returnAmount={classicsTotal.simulation_return}
                  profit={classicsTotal.simulation_profit}
                  roiPct={classicsTotal.simulation_roi_pct}
                  locale={locale}
                />
              )}

              {/* BLOC 3 — Vue d'ensemble Buteurs */}
              {scorersTotal && scorersTotal.total_resolved > 0 && (
                <AIStatsOverview
                  title={t("stats_scorers_title")}
                  subtitle={t("stats_scorers_subtitle")}
                  accent="fuchsia"
                  wins={scorersTotal.wins}
                  losses={scorersTotal.losses}
                  winRate={scorersTotal.win_rate_pct}
                  avgOdds={null}
                  avgOddsWon={null}
                  avgOddsLost={null}
                  locale={locale}
                  compact
                />
              )}

              {/* BLOC 4 — Classiques par sport */}
              {classicsBySport.length > 0 && (
                <AIStatsBySport stats={classicsBySport} locale={locale} />
              )}

              {/* BLOC 5 — Buteurs par ligue */}
              {scorersByLeague.length > 0 && (
                <AIStatsByLeague stats={scorersByLeague} locale={locale} />
              )}

              {/* BLOC 6 — Analyse de la confidence IA */}
              {(classicsTotal?.avg_confidence_all !== null ||
                scorersTotal?.avg_confidence_all !== null) && (
                <AIConfidenceAnalysis
                  classicsTotal={classicsTotal ?? null}
                  scorersTotal={scorersTotal ?? null}
                  locale={locale}
                />
              )}

            </div>
          )}

          {/* ═══ DISCLAIMER BAS ═══ */}
          <div className="mt-16">
            <AIDisclaimer locale={locale} />
          </div>

        </main>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════

async function EmptyStats({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-10 text-center text-white sm:p-14"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
        borderColor: "rgba(168, 85, 247, 0.25)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.35) 0%, transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 0% 100%, rgba(59, 130, 246, 0.25) 0%, transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #a855f7 30%, #3b82f6 70%, transparent 100%)",
        }}
      />

      <div className="relative z-10">
        <div className="mb-4 text-6xl">📊</div>
        <h3 className="mb-3 text-2xl font-extrabold">
          {t("stats_empty_title")}
        </h3>
        <p className="mx-auto max-w-md text-sm text-white/70">
          {t("stats_empty_description")}
        </p>
      </div>
    </div>
  );
}