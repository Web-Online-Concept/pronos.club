/**
 * ═══════════════════════════════════════════════════════════════════
 * /pronos-ia/match/[slug]/page.tsx (V3.5)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page dossier d'un pick IA.
 *
 * Mises à jour :
 *   - V3 (03/05/2026) : ajout sections stats avancées par sport
 *   - V3.5 (09/05/2026) : ajout 13 nouvelles sections enrichies
 *     · TierBadge (lock/strong/value/CDC)
 *     · CLVIndicator (post-résolution)
 *     · Football enrichi : Splits, RecentMatches, Sidelined, TopScorers
 *     · Tennis enrichi : PastMatches, TournamentRecord, CareerStats, FinalsTitles
 *     · Nouveaux sports : Rugby, Handball, F1
 *
 * Path :
 * src/app/[locale]/(public)/pronos-ia/match/[slug]/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { buildDossierData } from "@/lib/ai-picks-v2/dossier-builder";

// ─── Sections existantes V2/V3 ────────────────────────────────────
import {
  HeroPick,
  EdgeMathSection,
  BooksComparator,
  TeamFormSection,
  BoxscoreSection,
  RecordsSection,
  LineupsAndInjuries,
  HeadToHeadSection,
  IAReasoningSection,
  DisclaimerSection,
  FootballStatsSection,
  FootballPredictionSection,
  ClassementSection,
  H2HReelSection,
  PitchersSection,
  MMARecordsSection,
} from "@/components/ai-picks/DossierSections";

// ─── Sections V3.5 partie 1 (tier + CLV + foot enrichi) ───────────
import {
  TierBadgeSection,
  CLVIndicatorSection,
  FootballSplitsSection,
  FootballRecentMatchesSection,
  FootballSidelinedSection,
  FootballTopScorersSection,
} from "@/components/ai-picks/DossierSectionsV35";

// ─── Sections V3.5 partie 2 (tennis + rugby + handball + F1) ──────
import {
  TennisPastMatchesSection,
  TennisTournamentRecordSection,
  TennisCareerStatsSection,
  TennisFinalsTitlesSection,
  RugbyStatsSection,
  HandballStatsSection,
  F1RaceSection,
} from "@/components/ai-picks/DossierSectionsV35Part2";


// IMPORTANT Next.js 16 : params est une Promise
type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};


// ─── Metadata SEO ─────────────────────────────────────────────────


export async function generateMetadata(
  props: PageProps
): Promise<Metadata> {
  const { slug, locale } = await props.params;
  const data = await buildDossierData(slug, locale);
  if (!data) {
    return {
      title: "Pronostic IA introuvable — PRONOS.CLUB",
    };
  }

  const title = `${data.eventName} — ${data.selection} @${data.odds.toFixed(2)} | Pronostic IA`;
  const desc =
    data.edgePct !== null
      ? `Value bet IA détectée sur ${data.eventName} : ${data.selection} à ${data.odds.toFixed(2)} sur ${data.bookmaker}. Edge mathématique +${data.edgePct.toFixed(2)}%.`
      : `Pronostic IA sur ${data.eventName} : ${data.selection} à ${data.odds.toFixed(2)}.`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: "article",
    },
    alternates: {
      canonical: `/${locale}/pronos-ia/match/${slug}`,
    },
  };
}


// ─── Page ─────────────────────────────────────────────────────────


export default async function DossierPage(props: PageProps) {
  const { slug, locale } = await props.params;
  const data = await buildDossierData(slug, locale);

  if (!data) {
    notFound();
  }

  const isFootball = data.sport === "football" || data.sport === "soccer";
  const isBasketball = data.sport === "basketball";
  const isHockey = data.sport === "hockey";
  const isBaseball = data.sport === "baseball";
  const isMMA = data.sport === "mma";
  const isTennis = data.sport === "tennis";
  const isRugby = data.sport === "rugby";
  const isHandball = data.sport === "handball";
  const isF1 = data.sport === "formula-1" || data.sport === "formula_1";
  const isTeamSport = isBasketball || isHockey || isBaseball;

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

        {/* Numero pick + identifiant */}
        <div className="mb-4 flex items-center gap-3">
          <span className="px-3 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-full font-mono">
            IA-{String(data.classicNumber ?? data.scorerNumber ?? 0).padStart(4, "0")}
          </span>
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
            {data.sport} • {data.league}
          </span>
        </div>

        {/* Sections en colonne */}
        <div className="space-y-6">
          {/* 1. Hero verdict */}
          <HeroPick data={data} />

          {/* 2. V3.5 — Tier badge (juste sous le hero, très visible) */}
          <TierBadgeSection data={data} />

          {/* 3. V3.5 — CLV Indicator (uniquement si pick résolu avec CLV) */}
          <CLVIndicatorSection data={data} />

          {/* 4. Math du value bet */}
          <EdgeMathSection data={data} />

          {/* 5. Comparateur books */}
          <BooksComparator data={data} />

          {/* ═══ FOOTBALL ═════════════════════════════════════════════ */}
          {isFootball && (
            <>
              {/* 6. V3 — Stats équipe foot (existant) */}
              <FootballStatsSection data={data} />

              {/* 7. V3.5 — Splits domicile/extérieur */}
              <FootballSplitsSection data={data} />

              {/* 8. V3.5 — 5 derniers matchs détaillés (xG, possession, tirs) */}
              <FootballRecentMatchesSection data={data} />

              {/* 9. V3 — Prédiction algorithmique (existant) */}
              <FootballPredictionSection data={data} />

              {/* 10. V3.5 — Absents & suspendus */}
              <FootballSidelinedSection data={data} />

              {/* 11. V3.5 — Top buteurs de la league */}
              <FootballTopScorersSection data={data} />
            </>
          )}

          {/* ═══ TEAM SPORTS USA (basket/hockey/baseball) ════════════ */}
          {isTeamSport && (
            <>
              {/* 12. V3 — Classement (existant) */}
              <ClassementSection data={data} />

              {/* 13. V3 — H2H réel basket/hockey (existant) */}
              {(isBasketball || isHockey) && <H2HReelSection data={data} />}

              {/* 14. V3 — Lanceurs partants baseball (existant) */}
              {isBaseball && <PitchersSection data={data} />}
            </>
          )}

          {/* ═══ TENNIS ══════════════════════════════════════════════ */}
          {isTennis && (
            <>
              {/* 15. V3.5 — Past matches avec cotes pré-match */}
              <TennisPastMatchesSection data={data} />

              {/* 16. V3.5 — Record sur ce tournoi */}
              <TennisTournamentRecordSection data={data} />

              {/* 17. V3.5 — Stats serve/return de carrière */}
              <TennisCareerStatsSection data={data} />

              {/* 18. V3.5 — Finales et titres (uniquement si SF/Final) */}
              <TennisFinalsTitlesSection data={data} />
            </>
          )}

          {/* ═══ MMA ═════════════════════════════════════════════════ */}
          {isMMA && (
            <>
              {/* 19. V3 — Records MMA (existant) */}
              <MMARecordsSection data={data} />
            </>
          )}

          {/* ═══ RUGBY (V3.5 NOUVEAU) ═══════════════════════════════ */}
          {isRugby && (
            <>
              {/* 20. V3.5 — Stats rugby */}
              <RugbyStatsSection data={data} />
            </>
          )}

          {/* ═══ HANDBALL (V3.5 NOUVEAU) ════════════════════════════ */}
          {isHandball && (
            <>
              {/* 21. V3.5 — Stats handball */}
              <HandballStatsSection data={data} />
            </>
          )}

          {/* ═══ FORMULE 1 (V3.5 NOUVEAU) ═══════════════════════════ */}
          {isF1 && (
            <>
              {/* 22. V3.5 — Données GP F1 + grille de départ */}
              <F1RaceSection data={data} />
            </>
          )}

          {/* ═══ ESPN — multi-sports (existant V2/V3) ═══════════════ */}

          {/* 23. Bilan saison (ESPN) */}
          {data.espnContext?.eventSummary && (
            <RecordsSection summary={data.espnContext.eventSummary} />
          )}

          {/* 24. Forme equipes (ESPN) */}
          {data.espnContext &&
            (data.espnContext.homeForm || data.espnContext.awayForm) && (
              <TeamFormSection
                homeForm={data.espnContext.homeForm}
                awayForm={data.espnContext.awayForm}
                homeTeam={data.homeTeam}
                awayTeam={data.awayTeam}
              />
            )}

          {/* 25. Stats avancees ESPN (boxscore) */}
          {data.espnContext?.eventSummary && (
            <BoxscoreSection summary={data.espnContext.eventSummary} />
          )}

          {/* ═══ API-FOOTBALL (existant) ═══════════════════════════ */}

          {/* 26. H2H foot (API-Football) */}
          {data.apiFootballContext &&
            data.apiFootballContext.h2h &&
            data.apiFootballContext.h2h.length > 0 && (
              <HeadToHeadSection
                apiFootballContext={data.apiFootballContext}
              />
            )}

          {/* 27. Lineups + blessures foot (API-Football) */}
          {data.apiFootballContext && (
            <LineupsAndInjuries
              apiFootballContext={data.apiFootballContext}
            />
          )}

          {/* ═══ Analyse IA (toujours en bas) ═══════════════════════ */}

          {/* 28. Analyse IA Claude/GPT */}
          <IAReasoningSection data={data} />

          {/* 29. Disclaimer */}
          <DisclaimerSection />

          {/* CTA retour */}
          <div className="pt-8 text-center">
            <Link
              href={`/${locale}/pronos-ia`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 transition rounded-xl text-white font-semibold"
            >
              ← Voir tous les pronostics IA
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}