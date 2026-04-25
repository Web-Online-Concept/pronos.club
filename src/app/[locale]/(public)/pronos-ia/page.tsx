import { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Clock, History } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import AIPickCard, { type AIPickRow } from "@/components/ai-picks/AIPickCard";
import AIScorerCard, { type AIScorerRow } from "@/components/ai-picks/AIScorerCard";
import PronosIAButton from "@/components/ai-picks/ui/PronosIAButton";
import PronosIAHero from "@/components/ai-picks/ui/PronosIAHero";
import { buildPronosIAMetadata } from "@/lib/ai/ai-picks-metadata";

export const dynamic = "force-dynamic";
export const revalidate = 60;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPronosIAMetadata(locale, "live");
}


const getCurrentPicks = unstable_cache(
  async () => {
    const nowISO = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("ai_picks")
      .select(
        "id, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, odds_comparison, reasoning, ai_confidence, status, final_score, slug, consensus_tier, consensus_score",
      )
      .eq("status", "pending")
      .gt("event_date", nowISO)
      .order("consensus_score", { ascending: false, nullsFirst: false })
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
  ["ai-picks-current"],
  { revalidate: 60, tags: ["ai-picks-current"] },
);


export default async function PronosIAPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const { classics, scorers } = await getCurrentPicks();
  const totalCurrent = classics.length + scorers.length;

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">

      <PronosIAHero
        locale={locale}
        currentPage="live"
        title={t("page_title_live")}
        badgeLabel={t("badge_live_count", { count: totalCurrent })}
      />

      <main className="mx-auto max-w-[640px] px-4 py-10 sm:py-14">
        {totalCurrent === 0 ? (
          <EmptyStateNoPicks locale={locale} />
        ) : (
          <div className="space-y-8">
            {classics.length > 0 && (
              <section>
                <SectionHeader
                  emoji="🎯"
                  title={t("section_classics_title")}
                  count={classics.length}
                  accent="violet"
                />
                <div className="space-y-4">
                  {classics.map((pick) => (
                    <AIPickCard key={pick.id} pick={pick} locale={locale} />
                  ))}
                </div>
              </section>
            )}

            {scorers.length > 0 && (
              <section>
                <SectionHeader
                  emoji="⚽"
                  title={t("section_scorers_title")}
                  count={scorers.length}
                  accent="fuchsia"
                />
                <div className="space-y-4">
                  {scorers.map((pick) => (
                    <AIScorerCard key={pick.id} pick={pick} locale={locale} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <div className="mt-16">
          <AIDisclaimer locale={locale} />
        </div>
      </main>
    </div>
  );
}


function SectionHeader({
  emoji,
  title,
  count,
  accent,
}: {
  emoji: string;
  title: string;
  count: number;
  accent: "violet" | "fuchsia";
}) {
  const colors = {
    violet: {
      text: "text-violet-700",
      bg: "bg-violet-100",
      line: "from-violet-500/40",
    },
    fuchsia: {
      text: "text-fuchsia-700",
      bg: "bg-fuchsia-100",
      line: "from-fuchsia-500/40",
    },
  }[accent];

  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-lg font-bold uppercase tracking-wider text-neutral-800">
          {title}
        </h2>
        <span
          className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${colors.bg} ${colors.text}`}
        >
          {count}
        </span>
      </div>
      <div
        className={`h-px flex-1 bg-gradient-to-r ${colors.line} to-transparent`}
      />
    </div>
  );
}


async function EmptyStateNoPicks({ locale }: { locale: string }) {
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