/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/stats
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page des statistiques détaillées des Pronos IA.
 *
 * Blocs :
 *  - Vue d'ensemble classiques (wins/losses/%/cotes moyennes)
 *  - Simulation 1U par pick (mise/retour/profit/ROI)
 *  - Vue d'ensemble buteurs (stats simples)
 *  - Détail par sport (classiques)
 *  - Empty state si < 10 picks résolus
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ClassicStatsRow, ScorerStatsRow } from "@/lib/ai/ai-stats-types";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import AIStatsBlock from "@/components/ai-picks/AIStatsBlock";
import AISimulationBlock from "@/components/ai-picks/AISimulationBlock";
import AIStatsBySport from "@/components/ai-picks/AIStatsBySport";

export const revalidate = 600;


// ═══════════════════════════════════════════════════════════════════
// MÉTADONNÉES SEO
// ═══════════════════════════════════════════════════════════════════

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


/** Date de première génération pour l'en-tête "depuis le..." */
const getFirstPickDate = unstable_cache(
  async (): Promise<string | null> => {
    const { data, error } = await supabaseAdmin
      .from("ai_picks")
      .select("generation_batch")
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

/** Seuil en-dessous duquel on ne montre pas la page complète */
const MIN_PICKS_FOR_FULL_STATS = 10;


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

  // Par sport (classiques uniquement, sport != null, league == null)
  const classicsBySport = classics.filter(
    (r) => r.sport !== null && r.league === null,
  );

  const totalResolved =
    (classicsTotal?.total_resolved ?? 0) + (scorersTotal?.total_resolved ?? 0);

  const firstDateFormatted = firstPickDate
    ? new Date(firstPickDate).toLocaleDateString(
        { fr: "fr-FR", en: "en-US", es: "es-ES" }[locale] ?? "fr-FR",
        { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" },
      )
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
      <main className="pronos-ia-section mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

        {/* ═══ HEADER ═══ */}
        <header className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300">
            <span>📊</span>
            {t("stats_badge")}
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {t("stats_page_title")}
          </h1>
          <p className="mx-auto max-w-2xl text-base text-neutral-400">
            {firstDateFormatted
              ? t("stats_page_subtitle_since", { date: firstDateFormatted })
              : t("stats_page_subtitle_generic")}
          </p>
        </header>

        {/* ═══ BACK LINK ═══ */}
        <div className="mb-6">
          <Link
            href={`/${locale}/pronos-ia`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-neutral-200"
          >
            <span>←</span>
            <span>{t("link_back_to_picks")}</span>
          </Link>
        </div>

        {/* ═══ CONTENU ═══ */}
        {totalResolved < MIN_PICKS_FOR_FULL_STATS ? (
          <NotEnoughData
            title={t("stats_not_enough_title")}
            description={t("stats_not_enough_description", {
              count: totalResolved,
              required: MIN_PICKS_FOR_FULL_STATS,
            })}
          />
        ) : (
          <div className="space-y-8">

            {/* BLOC 1 : Vue d'ensemble classiques */}
            {classicsTotal && classicsTotal.total_resolved > 0 && (
              <AIStatsBlock
                title={t("stats_classics_title")}
                subtitle={t("stats_classics_subtitle")}
                wins={classicsTotal.wins}
                losses={classicsTotal.losses}
                winRate={classicsTotal.win_rate_pct}
                avgOdds={classicsTotal.avg_odds}
                avgOddsWon={classicsTotal.avg_odds_won}
                avgOddsLost={classicsTotal.avg_odds_lost}
                locale={locale}
              />
            )}

            {/* BLOC 2 : Simulation 1U */}
            {classicsTotal && classicsTotal.simulation_stake > 0 && (
              <AISimulationBlock
                stake={classicsTotal.simulation_stake}
                returnAmount={classicsTotal.simulation_return}
                profit={classicsTotal.simulation_profit}
                roiPct={classicsTotal.simulation_roi_pct}
                locale={locale}
              />
            )}

            {/* BLOC 3 : Vue d'ensemble buteurs */}
            {scorersTotal && scorersTotal.total_resolved > 0 && (
              <AIStatsBlock
                title={t("stats_scorers_title")}
                subtitle={t("stats_scorers_subtitle")}
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

            {/* BLOC 4 : Détail par sport (classiques) */}
            {classicsBySport.length > 0 && (
              <AIStatsBySport stats={classicsBySport} locale={locale} />
            )}

          </div>
        )}

        {/* ═══ DISCLAIMER BAS ═══ */}
        <div className="mt-16">
          <AIDisclaimer locale={locale} compact />
        </div>

      </main>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// COMPOSANT INTERNE — empty state
// ═══════════════════════════════════════════════════════════════════

function NotEnoughData({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="my-16 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-10 text-center">
      <div className="mb-4 text-5xl">📊</div>
      <h3 className="mb-2 text-xl font-semibold text-neutral-100">{title}</h3>
      <p className="mx-auto max-w-md text-sm text-neutral-400">{description}</p>
    </div>
  );
}