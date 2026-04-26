/**
 * ═══════════════════════════════════════════════════════════════════
 * /pronos-ia/match/[slug]/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page dossier d'un pick IA.
 *
 * Server Component : recupere toutes les data en 1 fetch agregé puis
 * assemble les sections visuelles. SEO friendly grace au rendu
 * server-side de tout le contenu.
 *
 * Background blanc, sections internes restent sombres (rendu pro).
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

        {/* Sections en colonne — chaque section garde son fond sombre interne */}
        <div className="space-y-6">
          {/* 1. Hero verdict */}
          <HeroPick data={data} />

          {/* 2. Math du value bet */}
          <EdgeMathSection data={data} />

          {/* 3. Comparateur 6 books */}
          <BooksComparator data={data} />

          {/* 4. Bilan saison (foot ou ESPN) */}
          {data.espnContext?.eventSummary && (
            <RecordsSection summary={data.espnContext.eventSummary} />
          )}

          {/* 5. Forme equipes */}
          {data.espnContext &&
            (data.espnContext.homeForm || data.espnContext.awayForm) && (
              <TeamFormSection
                homeForm={data.espnContext.homeForm}
                awayForm={data.espnContext.awayForm}
                homeTeam={data.homeTeam}
                awayTeam={data.awayTeam}
              />
            )}

          {/* 6. Stats avancees ESPN (boxscore) */}
          {data.espnContext?.eventSummary && (
            <BoxscoreSection summary={data.espnContext.eventSummary} />
          )}

          {/* 7. H2H (foot uniquement, via API-Football) */}
          {data.apiFootballContext &&
            data.apiFootballContext.h2h &&
            data.apiFootballContext.h2h.length > 0 && (
              <HeadToHeadSection
                apiFootballContext={data.apiFootballContext}
              />
            )}

          {/* 8. Lineups + blessures (foot uniquement) */}
          {data.apiFootballContext && (
            <LineupsAndInjuries
              apiFootballContext={data.apiFootballContext}
            />
          )}

          {/* 9. Analyse IA */}
          <IAReasoningSection data={data} />

          {/* 10. Disclaimer bankroll */}
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