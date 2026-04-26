/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia
 * ═══════════════════════════════════════════════════════════════════
 *
 * Utilise le composant <AiPickCard /> autonome (séparé de Tipster).
 * Garantit visuellement la même structure que les pronos Tipster,
 * avec ribbon "🤖 IA" et footer "Intelligence Artificielle".
 *
 * Affiche les labels IA-XXXX (classiques) et BUT-XXXX (buteurs).
 * Sections séparées : Classiques (en haut) + Buteurs (en bas).
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Clock, History } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AiPickCard from "@/components/ai-picks/AiPickCard";
import {
  adaptAiPickToCardData,
  type AIPickRow,
} from "@/lib/ai-picks-v2/adapt-ai-pick";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import PronosIAButton from "@/components/ai-picks/ui/PronosIAButton";
import PronosIAHero from "@/components/ai-picks/ui/PronosIAHero";
import { buildPronosIAMetadata } from "@/lib/ai/ai-picks-metadata";


export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPronosIAMetadata(locale, "live");
}


const getCurrentPicks = async (): Promise<AIPickRow[]> => {
  const nowISO = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, ai_pick_number, classic_number, scorer_number, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, reasoning, ai_confidence, status, final_score, profit, slug, consensus_tier, consensus_score, live_score_data"
    )
    .eq("status", "pending")
    .is("deleted_at", null)
    .gt("event_date", nowISO)
    .order("consensus_score", { ascending: false, nullsFirst: false })
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[pronos-ia] Erreur fetch picks:", error);
    return [];
  }

  return (data ?? []) as AIPickRow[];
};


export default async function PronosIAPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const aiPicks = await getCurrentPicks();
  const totalCurrent = aiPicks.length;

  // Séparation classiques / buteurs
  const classicPicks = aiPicks.filter((p) => p.pick_type === "classic");
  const scorerPicks = aiPicks.filter((p) => p.pick_type === "scorer");

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">
      <PronosIAHero
        locale={locale}
        currentPage="live"
        title={t("page_title_live")}
        badgeLabel={t("badge_live_count", { count: totalCurrent })}
      />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-4">
        {totalCurrent === 0 ? (
          <EmptyStateNoPicks locale={locale} />
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════ */}
            {/* SECTION 1 — Pronos Classiques                       */}
            {/* ═══════════════════════════════════════════════════ */}
            <SectionHeader
              icon="🎯"
              title="Pronos Classiques"
              subtitle="Pronostics principaux de notre IA — comptabilisés dans la bankroll IA"
              count={classicPicks.length}
            />

            {classicPicks.length > 0 ? (
              <div className="mt-4 space-y-4">
                {classicPicks.map((aiPick) => (
                  <AiPickCard
                    key={aiPick.id}
                    pick={adaptAiPickToCardData(aiPick, locale)}
                  />
                ))}
              </div>
            ) : (
              <EmptyMessage text="Aucun pronostic classique en cours" />
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* SECTION 2 — Pronos Buteurs                          */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="mt-12">
              <SectionHeader
                icon="⚽"
                title="Pronos Buteurs"
                subtitle="Pronostics bonus à haut risque — bankroll séparée et indépendante"
                count={scorerPicks.length}
                variant="scorer"
              />

              {scorerPicks.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {scorerPicks.map((aiPick) => (
                    <AiPickCard
                      key={aiPick.id}
                      pick={adaptAiPickToCardData(aiPick, locale)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyMessage text="Aucun prono buteur en cours" />
              )}
            </div>
          </>
        )}

        <div className="mt-16">
          <AIDisclaimer locale={locale} />
        </div>
      </main>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: string;
  title: string;
  subtitle: string;
  count: number;
  variant?: "classic" | "scorer";
}

function SectionHeader({
  icon,
  title,
  subtitle,
  count,
  variant = "classic",
}: SectionHeaderProps) {
  const accentColor = variant === "scorer" ? "#f59e0b" : "#a855f7";
  const bgColor =
    variant === "scorer" ? "rgba(245, 158, 11, 0.08)" : "rgba(168, 85, 247, 0.08)";
  const borderColor =
    variant === "scorer" ? "rgba(245, 158, 11, 0.25)" : "rgba(168, 85, 247, 0.25)";

  return (
    <div
      className="mt-6 rounded-2xl border px-5 py-4"
      style={{ background: bgColor, borderColor }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">{icon}</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-extrabold text-neutral-900">{title}</h2>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              {count} {count > 1 ? "pronos" : "prono"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}


function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-8 text-center">
      <p className="text-sm font-semibold text-neutral-500">{text}</p>
    </div>
  );
}


async function EmptyStateNoPicks({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return (
    <div
      className="mt-4 relative overflow-hidden rounded-2xl border p-10 text-center text-white sm:p-14"
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
        <div className="mb-4 text-6xl">🤖</div>
        <h3 className="mb-3 text-2xl font-extrabold">{t("empty_live_title")}</h3>
        <p className="mx-auto mb-6 max-w-md text-sm text-white/70">
          {t("empty_live_description")}
        </p>

        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/80 backdrop-blur">
          <Clock size={14} strokeWidth={2.5} className="text-violet-300" />
          <span>{t("empty_live_next_generation")}</span>
        </div>

        <div className="flex justify-center">
          <PronosIAButton
            href={`/${locale}/pronos-ia/historique`}
            variant="primary"
            size="md"
          >
            <History size={14} strokeWidth={2.5} />
            {t("empty_live_cta_history")}
          </PronosIAButton>
        </div>
      </div>
    </div>
  );
}