/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia (V2 DESIGN)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fond blanc + cards sombres (style Calculateurs) + accent violet/bleu.
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { HelpCircle, BarChart3, History } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import AIStatsMiniBanner from "@/components/ai-picks/AIStatsMiniBanner";
import AITabs from "@/components/ai-picks/AITabs";
import AIPickCard, { type AIPickRow } from "@/components/ai-picks/AIPickCard";
import AIScorerCard, { type AIScorerRow } from "@/components/ai-picks/AIScorerCard";
import PronosIAButton from "@/components/ai-picks/ui/PronosIAButton";

export const revalidate = 300;


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


const getTodayPicks = unstable_cache(
  async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("ai_picks")
      .select(
        "id, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, odds_comparison, reasoning, ai_confidence, status, final_score",
      )
      .eq("generation_batch", today)
      .in("status", ["pending", "won", "lost", "void"])
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


interface StatsGlobal {
  wins: number;
  losses: number;
  totalResolved: number;
  winRate: number | null;
}

const getGlobalStats = unstable_cache(
  async (): Promise<StatsGlobal> => {
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
  const todayLabel = formatTodayDateServer(locale);

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">
      {/* Fond décoratif subtil : gradient radial violet en haut */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[400px] opacity-[0.05]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, #8b5cf6 0%, transparent 60%)",
          }}
        />

        <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

          {/* ═══ HERO ═══ */}
          <header className="mb-10 text-center">
            {/* Badge expérimental */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500"></span>
              {t("badge_experimental")}
            </div>

            {/* Titre avec gradient */}
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #a855f7 100%)",
                }}
              >
                {t("page_title")}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-base text-neutral-600 sm:text-lg">
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
          <div className="my-8 flex flex-wrap items-center justify-center gap-3">
            <PronosIAButton
              href={`/${locale}/pronos-ia/comment-ca-marche`}
              variant="secondary"
              size="sm"
            >
              <HelpCircle size={14} strokeWidth={2.5} />
              {t("link_how_it_works")}
            </PronosIAButton>
            <PronosIAButton
              href={`/${locale}/pronos-ia/stats`}
              variant="secondary"
              size="sm"
            >
              <BarChart3 size={14} strokeWidth={2.5} />
              {t("link_full_stats")}
            </PronosIAButton>
            <PronosIAButton
              href={`/${locale}/pronos-ia/historique`}
              variant="secondary"
              size="sm"
            >
              <History size={14} strokeWidth={2.5} />
              {t("link_history")}
            </PronosIAButton>
          </div>

          {/* ═══ DATE DU JOUR ═══ */}
          <div className="my-12 text-center">
            <div
              className="inline-block rounded-full px-4 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-white"
              style={{
                background:
                  "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              }}
            >
              {t("today_label")}
            </div>
            <h2 className="mt-4 text-2xl font-bold capitalize text-neutral-900 sm:text-3xl">
              {todayLabel}
            </h2>
          </div>

          {/* ═══ CONTENU ═══ */}
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
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// EMPTY STATES (en version card sombre)
// ═══════════════════════════════════════════════════════════════════

function EmptyStateContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="relative my-12 overflow-hidden rounded-2xl border border-white/[0.08] p-12 text-center text-white"
      style={{
        background:
          "linear-gradient(135deg, #0a0a0a 0%, #8b5cf60c 100%)",
      }}
    >
      <div
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #8b5cf6 50%, transparent 100%)",
        }}
      />
      <div className="mb-4 text-5xl">🤖</div>
      <h3 className="mb-2 text-xl font-bold">{title}</h3>
      <p className="mx-auto max-w-md text-sm text-white/60">{description}</p>
    </div>
  );
}

function EmptyTabMessage({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}


function formatTodayDateServer(locale: string): string {
  const map: Record<string, string> = { fr: "fr-FR", en: "en-US", es: "es-ES" };
  return new Date().toLocaleDateString(map[locale] ?? "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}