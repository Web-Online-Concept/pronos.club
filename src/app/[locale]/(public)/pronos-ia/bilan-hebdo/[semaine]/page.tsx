/**
 * ═══════════════════════════════════════════════════════════════════
 * /pronos-ia/bilan-hebdo/[semaine]/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page bilan hebdomadaire d'une semaine ISO donnée.
 *
 * URL : https://pronos.club/[locale]/pronos-ia/bilan-hebdo/[semaine]
 * Slug : "semaine-19-2026" (Q21-B validé)
 *
 * Lit les données depuis weekly_bilans (cache préagrégé par le cron
 * dimanche 22h Paris). Si la semaine n'existe pas → 404.
 *
 * Layout :
 *   - Hero header (semaine + KPIs ROI + profit)
 *   - 4 KPI cards (winrate, ROI, profit, CLV)
 *   - Graph 1 : Bankroll cumulée jour par jour (line chart)
 *   - Graph 2 : Donut V/D/N
 *   - Graph 3 : Bar chart ROI par tier
 *   - Graph 4 : Bar chart profit par sport
 *   - Liste détaillée des picks avec ✅/❌/➖
 *   - CTA Telegram + lien tipster
 *   - Disclaimer ANJ
 *
 * Path : src/app/[locale]/(public)/pronos-ia/bilan-hebdo/[semaine]/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getWeeklyBilanBySlug } from "@/lib/bilan/hebdo-generator";
import { BilanHebdoCharts } from "@/components/bilan/BilanHebdoCharts";

// IMPORTANT Next.js 16 : params est une Promise
type PageProps = {
  params: Promise<{ locale: string; semaine: string }>;
};

// ─── Metadata SEO ─────────────────────────────────────────────────

export async function generateMetadata(
  props: PageProps
): Promise<Metadata> {
  const { semaine, locale } = await props.params;
  const bilan = await getWeeklyBilanBySlug(semaine);

  if (!bilan) {
    return {
      title: "Bilan hebdo introuvable — PRONOS.CLUB",
    };
  }

  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const title = `Bilan semaine ${bilan.week_number} ${bilan.week_year} : ROI ${roiSign}${bilan.roi_pct.toFixed(2)}% sur ${bilan.total_picks} picks IA | PRONOS.CLUB`;
  const desc = `Bilan complet de la semaine ${bilan.week_number} (${bilan.week_label}) : ${bilan.picks_won} gagnés / ${bilan.picks_lost} perdus, profit ${bilan.total_profit_units >= 0 ? "+" : ""}${bilan.total_profit_units.toFixed(2)}U, CLV moyen ${bilan.clv_avg_pct !== null ? (bilan.clv_avg_pct >= 0 ? "+" : "") + bilan.clv_avg_pct.toFixed(2) + "%" : "n/a"}. Pronostics IA gratuits, transparence totale.`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: "article",
    },
    alternates: {
      canonical: `/${locale}/pronos-ia/bilan-hebdo/${semaine}`,
    },
  };
}

// ─── Helpers d'affichage ──────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽",
  tennis: "🎾",
  basketball: "🏀",
  hockey: "🏒",
  baseball: "⚾",
  mma: "🥊",
  "football-americain": "🏈",
  rugby: "🏉",
  handball: "🤾",
  "formula-1": "🏎️",
  multi: "🎯",
};

const TIER_DISPLAY: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  lock: { emoji: "🔒", label: "Lock", bg: "bg-emerald-100", text: "text-emerald-700" },
  strong: { emoji: "💪", label: "Strong", bg: "bg-blue-100", text: "text-blue-700" },
  value: { emoji: "💎", label: "Value", bg: "bg-violet-100", text: "text-violet-700" },
  coup_de_coeur: { emoji: "❤️", label: "Coup de cœur", bg: "bg-pink-100", text: "text-pink-700" },
};

const formatDateFr = (dateStr: string): string => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
};

// ─── Page ─────────────────────────────────────────────────────────

export default async function BilanHebdoPage(props: PageProps) {
  const { semaine, locale } = await props.params;
  const bilan = await getWeeklyBilanBySlug(semaine);

  if (!bilan) {
    notFound();
  }

  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const isPositiveRoi = bilan.roi_pct > 0;
  const isNegativeRoi = bilan.roi_pct < 0;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-zinc-500">
          <Link
            href={`/${locale}/pronos-ia`}
            className="hover:text-zinc-900 transition"
          >
            ← Retour aux Pronos IA
          </Link>
        </div>

        {/* Badge bilan + semaine */}
        <div className="mb-4 flex items-center gap-3">
          <span className="px-3 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-full font-mono">
            BILAN HEBDO
          </span>
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
            {bilan.week_iso}
          </span>
        </div>

        {/* Hero */}
        <header className="mb-10 border-b border-zinc-200 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-zinc-900">
            Semaine {bilan.week_number}
          </h1>
          <p className="text-lg text-zinc-600 mb-6 capitalize">{bilan.week_label}</p>

          {/* Hero stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`rounded-xl p-4 border-2 ${
              isPositiveRoi
                ? "border-emerald-200 bg-emerald-50"
                : isNegativeRoi
                  ? "border-red-200 bg-red-50"
                  : "border-zinc-200 bg-zinc-50"
            }`}>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">ROI</div>
              <div className={`text-2xl md:text-3xl font-bold ${
                isPositiveRoi ? "text-emerald-700" : isNegativeRoi ? "text-red-700" : "text-zinc-700"
              }`}>
                {roiSign}{bilan.roi_pct.toFixed(2)}%
              </div>
            </div>
            <div className={`rounded-xl p-4 border-2 ${
              bilan.total_profit_units >= 0
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}>
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Profit</div>
              <div className={`text-2xl md:text-3xl font-bold ${
                bilan.total_profit_units >= 0 ? "text-emerald-700" : "text-red-700"
              }`}>
                {profitSign}{bilan.total_profit_units.toFixed(2)}U
              </div>
            </div>
            <div className="rounded-xl p-4 border-2 border-zinc-200 bg-zinc-50">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Picks</div>
              <div className="text-2xl md:text-3xl font-bold text-zinc-900">
                {bilan.total_picks}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {bilan.picks_won}V / {bilan.picks_lost}D{bilan.picks_void > 0 ? ` / ${bilan.picks_void}N` : ""}
              </div>
            </div>
            <div className="rounded-xl p-4 border-2 border-zinc-200 bg-zinc-50">
              <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Winrate</div>
              <div className="text-2xl md:text-3xl font-bold text-zinc-900">
                {bilan.winrate_pct.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* CLV Highlight (si dispo) */}
          {bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0 && (
            <div className={`mt-4 rounded-xl p-4 border-2 ${
              bilan.clv_avg_pct > 0
                ? "border-amber-200 bg-amber-50"
                : "border-zinc-200 bg-zinc-50"
            }`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-xs text-amber-700 uppercase tracking-wider font-semibold mb-1">
                    {bilan.clv_avg_pct > 0 ? "⚡ Edge marché validé" : "📉 Sous-performance marché"}
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-zinc-900">
                    CLV moyen : {bilan.clv_avg_pct >= 0 ? "+" : ""}{bilan.clv_avg_pct.toFixed(2)}%
                  </div>
                  <div className="text-sm text-zinc-600 mt-1">
                    Sur {bilan.clv_picks_count} pick{bilan.clv_picks_count > 1 ? "s" : ""} avec closing capturé
                  </div>
                </div>
                <div className="text-xs text-zinc-500 max-w-md">
                  Le <strong>Closing Line Value</strong> mesure si nos cotes battent la cote efficient finale du marché (Pinnacle no-vig). Un CLV positif = edge IA réel.
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Charts (Client component) */}
        <BilanHebdoCharts bilan={bilan} />

        {/* Liste détaillée des picks */}
        {bilan.picks.length > 0 && (
          <section className="mt-10">
            <h2 className="text-2xl font-bold mb-6 text-zinc-900">
              Détail de la semaine ({bilan.picks.length} picks)
            </h2>
            <div className="space-y-2">
              {bilan.picks.map((pick) => {
                const tierInfo = pick.tier ? TIER_DISPLAY[pick.tier] : null;
                const sportEmoji = SPORT_EMOJI[pick.sport] ?? "🎯";
                const statusEmoji =
                  pick.status === "won" ? "✅" : pick.status === "lost" ? "❌" : "➖";
                const statusColor =
                  pick.status === "won"
                    ? "text-emerald-700"
                    : pick.status === "lost"
                      ? "text-red-700"
                      : "text-zinc-500";

                return (
                  <div
                    key={pick.pick_id}
                    className="rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 transition"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className={`text-xl ${statusColor}`}>{statusEmoji}</span>
                        <span className="text-lg shrink-0">{sportEmoji}</span>
                        {tierInfo && (
                          <span className={`px-2 py-0.5 ${tierInfo.bg} ${tierInfo.text} text-xs font-bold rounded-full shrink-0`}>
                            {tierInfo.emoji} {tierInfo.label}
                          </span>
                        )}
                        <span className="text-xs text-zinc-500 shrink-0">
                          {formatDateFr(pick.date)}
                        </span>
                        <div className="min-w-0 flex-1">
                          {pick.slug ? (
                            <Link
                              href={`/${locale}/pronos-ia/match/${pick.slug}`}
                              className="text-sm font-semibold text-zinc-900 hover:text-violet-700 transition truncate block"
                            >
                              {pick.event_name}
                            </Link>
                          ) : (
                            <div className="text-sm font-semibold text-zinc-900 truncate">
                              {pick.event_name}
                            </div>
                          )}
                          <div className="text-xs text-zinc-600 truncate">
                            {pick.selection} @ {pick.odds.toFixed(2)}
                            {pick.final_score && (
                              <span className="text-zinc-400 ml-2">({pick.final_score})</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`text-sm font-bold shrink-0 ${
                        pick.profit > 0 ? "text-emerald-700" : pick.profit < 0 ? "text-red-700" : "text-zinc-500"
                      }`}>
                        {pick.profit > 0 ? "+" : ""}{pick.profit.toFixed(2)}U
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* CTA Telegram + tipster Jérôme Bollaert */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://t.me/pronos_club_ia"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl p-6 border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
          >
            <div className="text-2xl mb-2">📱</div>
            <h3 className="text-lg font-bold mb-1 text-blue-900">Suivez-nous sur Telegram</h3>
            <p className="text-sm text-blue-700">
              Recevez chaque pronostic IA en direct sur le canal public @pronos_club_ia
            </p>
          </a>
          <Link
            href={`/${locale}`}
            className="rounded-xl p-6 border-2 border-violet-200 bg-violet-50 hover:bg-violet-100 transition"
          >
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="text-lg font-bold mb-1 text-violet-900">Pronos abonnés Jérôme Bollaert</h3>
            <p className="text-sm text-violet-700">
              Découvrez les pronostics du tipster humain et sa stratégie long terme
            </p>
          </Link>
        </section>

        {/* Disclaimer ANJ */}
        <section className="mt-8 rounded-xl bg-zinc-100 p-4 text-xs text-zinc-600">
          <div className="font-semibold mb-1 text-zinc-900">🔞 Jeu responsable</div>
          <p>
            Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le <strong>09 74 75 13 13</strong> (appel non surtaxé). Visitez{" "}
            <a
              href="https://www.joueurs-info-service.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-900"
            >
              joueurs-info-service.fr
            </a>
            . Pronostics réservés aux personnes majeures.
          </p>
        </section>

        {/* Retour */}
        <div className="mt-10 text-center">
          <Link
            href={`/${locale}/pronos-ia`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 transition rounded-xl text-white font-semibold"
          >
            ← Voir tous les pronostics IA
          </Link>
        </div>
      </div>
    </div>
  );
}