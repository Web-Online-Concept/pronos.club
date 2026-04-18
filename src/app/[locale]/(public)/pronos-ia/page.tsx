/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia (+ /en/pronos-ia, /es/pronos-ia)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page principale des Pronos IA.
 * - Disclaimer permanent
 * - Mini résumé stats (ou placeholder si pas encore de données)
 * - Onglets Classiques (max 5) / Buteurs (max 3)
 * - Cards compactes
 * - Message si aucun pick aujourd'hui
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import AIStatsMiniBanner from "@/components/ai-picks/AIStatsMiniBanner";
import AITabs from "@/components/ai-picks/AITabs";
import AIPickCard, { type AIPickRow } from "@/components/ai-picks/AIPickCard";
import AIScorerCard, { type AIScorerRow } from "@/components/ai-picks/AIScorerCard";

// Revalidation côté serveur toutes les 5 min
export const revalidate = 300;


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
    title: t("meta_title"),
    description: t("meta_description"),
    robots: { index: true, follow: true },
  };
}


// ═══════════════════════════════════════════════════════════════════
// DATA FETCHING — picks du jour
// ═══════════════════════════════════════════════════════════════════

const getTodayPicks = unstable_cache(
  async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("ai_picks")
      .select(
        "id, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, odds_comparison, reasoning, ai_confidence, status, final_score",
      )
      .eq("generation_batch", today)
      .in("status", ["pending", "won", "lost", "void"]) // Exclut pending_review et rejected_by_audit
      .order("event_date", { ascending: true });

    if (error) {
      console.error("[pronos-ia] Erreur fetch picks:", error);
      return { classics: [] as AIPickRow[], scorers: [] as AIScorerRow[] };
    }

    const rows = data ?? [];
    return {
      classics: rows.filter((r) => r.pick_type === "classic") as AIPickRow[],
      scorers: rows.filter((r) => r.pick_type === "scorer") as AIScorerRow[],
    };
  },
  ["ai-picks-today"],
  { revalidate: 300, tags: ["ai-picks-today"] },
);


// ═══════════════════════════════════════════════════════════════════
// DATA FETCHING — stats cumulées
// ═══════════════════════════════════════════════════════════════════

interface StatsGlobal {
  wins: number;
  losses: number;
  totalResolved: number;
  winRate: number | null;
}

const getGlobalStats = unstable_cache(
  async (): Promise<StatsGlobal> => {
    // La vue ai_stats_global a une ligne avec pick_type=NULL + sport=NULL
    // qui contient les stats globales grâce au GROUPING SETS
    const { data, error } = await supabaseAdmin
      .from("ai_stats_global")
      .select("*")
      .is("pick_type", null)
      .is("sport", null)
      .maybeSingle();

    if (error || !data) {
      return { wins: 0, losses: 0, totalResolved: 0, winRate: null };
    }

    return {
      wins: Number(data.wins) || 0,
      losses: Number(data.losses) || 0,
      totalResolved: Number(data.total_resolved) || 0,
      winRate: data.win_rate_pct !== null ? Number(data.win_rate_pct) : null,
    };
  },
  ["ai-stats-global"],
  { revalidate: 600, tags: ["ai-stats-global"] },
);


// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

export default async function PronosIAPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const [picksData, stats] = await Promise.all([getTodayPicks(), getGlobalStats()]);
  const { classics, scorers } = picksData;

  const totalToday = classics.length + scorers.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

        {/* ═══ HEADER ═══ */}
        <header className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400"></span>
            {t("badge_experimental")}
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {t("page_title")}
          </h1>
          <p className="mx-auto max-w-2xl text-base text-neutral-400">
            {t("page_subtitle")}
          </p>
        </header>

        {/* ═══ DISCLAIMER HAUT ═══ */}
        <AIDisclaimer locale={locale} />

        {/* ═══ MINI STATS BANNER ═══ */}
        <div className="my-8">
          <AIStatsMiniBanner
            wins={stats.wins}
            losses={stats.losses}
            totalResolved={stats.totalResolved}
            winRate={stats.winRate}
            locale={locale}
          />
        </div>

        {/* ═══ LIENS UTILES ═══ */}
        <div className="my-6 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href={`/${locale}/pronos-ia/comment-ca-marche`}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800/60 px-4 py-2 font-medium text-neutral-200 transition hover:bg-neutral-800"
          >
            <span>❓</span>
            <span>{t("link_how_it_works")}</span>
          </Link>
          <Link
            href={`/${locale}/pronos-ia/stats`}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800/60 px-4 py-2 font-medium text-neutral-200 transition hover:bg-neutral-800"
          >
            <span>📊</span>
            <span>{t("link_full_stats")}</span>
          </Link>
          <Link
            href={`/${locale}/pronos-ia/historique`}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800/60 px-4 py-2 font-medium text-neutral-200 transition hover:bg-neutral-800"
          >
            <span>🕐</span>
            <span>{t("link_history")}</span>
          </Link>
        </div>

        {/* ═══ DATE DU JOUR ═══ */}
        <div className="my-10 text-center">
          <div className="inline-block rounded-full bg-emerald-500/10 px-4 py-1 text-xs font-medium uppercase tracking-wider text-emerald-400">
            {t("today_label")}
          </div>
          <h2 className="mt-3 text-2xl font-bold text-neutral-100">
            {formatTodayDate(locale)}
          </h2>
        </div>

        {/* ═══ CONTENU — soit empty state, soit onglets + cards ═══ */}
        {totalToday === 0 ? (
          <EmptyStateContent
            title={t("empty_state_title")}
            description={t("empty_state_description")}
          />
        ) : (
          <AITabs
            classicsCount={classics.length}
            scorersCount={scorers.length}
            locale={locale}
            classicsContent={
              <div className="space-y-4">
                {classics.length === 0 ? (
                  <EmptyTabMessage message={t("no_classics_today")} />
                ) : (
                  classics.map((pick) => (
                    <AIPickCard key={pick.id} pick={pick} locale={locale} />
                  ))
                )}
              </div>
            }
            scorersContent={
              <div className="space-y-4">
                {scorers.length === 0 ? (
                  <EmptyTabMessage message={t("no_scorers_today")} />
                ) : (
                  scorers.map((pick) => (
                    <AIScorerCard key={pick.id} pick={pick} locale={locale} />
                  ))
                )}
              </div>
            }
          />
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
// COMPOSANTS INTERNES
// ═══════════════════════════════════════════════════════════════════

function EmptyStateContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="my-16 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-10 text-center">
      <div className="mb-4 text-5xl">🤖</div>
      <h3 className="mb-2 text-xl font-semibold text-neutral-100">{title}</h3>
      <p className="mx-auto max-w-md text-sm text-neutral-400">{description}</p>
    </div>
  );
}

function EmptyTabMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-8 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// HELPER — format date selon locale
// ═══════════════════════════════════════════════════════════════════

function formatTodayDate(locale: string): string {
  const map: Record<string, string> = { fr: "fr-FR", en: "en-US", es: "es-ES" };
  return new Date().toLocaleDateString(map[locale] ?? "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}