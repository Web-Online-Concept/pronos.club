/**
 * ═══════════════════════════════════════════════════════════════════
 * /pronos-ia/match/[slug]/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page dossier d'un pick IA.
 * Mise à jour v3 (03/05/2026) : ajout sections stats avancées par sport.
 *
 * Path :
 * src/app/[locale]/(public)/pronos-ia/match/[slug]/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { buildDossierData } from "@/lib/ai-picks-v2/dossier-builder";
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

          {/* 2. Math du value bet */}
          <EdgeMathSection data={data} />

          {/* 3. Comparateur books */}
          <BooksComparator data={data} />

          {/* 4. Stats équipe football (v3) */}
          {isFootball && <FootballStatsSection data={data} />}

          {/* 5. Prédiction algorithmique football (v3) */}
          {isFootball && <FootballPredictionSection data={data} />}

          {/* 6. Classement basket / hockey / baseball (v3) */}
          {isTeamSport && <ClassementSection data={data} />}

          {/* 7. H2H réel basket / hockey (v3) */}
          {(isBasketball || isHockey) && <H2HReelSection data={data} />}

          {/* 8. Lanceurs partants baseball (v3) */}
          {isBaseball && <PitchersSection data={data} />}

          {/* 9. Records MMA (v3) */}
          {isMMA && <MMARecordsSection data={data} />}

          {/* 10. Bilan saison (ESPN) */}
          {data.espnContext?.eventSummary && (
            <RecordsSection summary={data.espnContext.eventSummary} />
          )}

          {/* 11. Forme equipes (ESPN) */}
          {data.espnContext &&
            (data.espnContext.homeForm || data.espnContext.awayForm) && (
              <TeamFormSection
                homeForm={data.espnContext.homeForm}
                awayForm={data.espnContext.awayForm}
                homeTeam={data.homeTeam}
                awayTeam={data.awayTeam}
              />
            )}

          {/* 12. Stats avancees ESPN (boxscore) */}
          {data.espnContext?.eventSummary && (
            <BoxscoreSection summary={data.espnContext.eventSummary} />
          )}

          {/* 13. H2H foot (API-Football) */}
          {data.apiFootballContext &&
            data.apiFootballContext.h2h &&
            data.apiFootballContext.h2h.length > 0 && (
              <HeadToHeadSection
                apiFootballContext={data.apiFootballContext}
              />
            )}

          {/* 14. Lineups + blessures foot (API-Football) */}
          {data.apiFootballContext && (
            <LineupsAndInjuries
              apiFootballContext={data.apiFootballContext}
            />
          )}

          {/* 15. Analyse IA */}
          <IAReasoningSection data={data} />

          {/* 16. Disclaimer */}
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