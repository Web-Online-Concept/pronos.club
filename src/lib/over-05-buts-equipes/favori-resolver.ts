// src/lib/over-05-buts-equipes/favori-resolver.ts
//
// Identifie le "favori intrinseque" d'un match selon la methode PROJETS Bertrand.
//
// Logique (validee Q2 = A) :
//
//  1. Comparer les CATEGORIES (hierarchie sportive)
//     ELITE > EUROPE > AMBITIEUX > MILIEU > MAINTIEN
//     -> Si une equipe a une categorie superieure, elle est favori.
//
//  2. Si MEME CATEGORIE : comparer avg_rank_historical
//     (la plus basse = la plus forte historiquement)
//     -> PSG 1.20 < Marseille 4.0 -> PSG favori meme si tous deux ELITE.
//
//  3. Si MEME CATEGORIE et MEME moyenne historique :
//     -> Avantage du terrain : l'equipe a domicile est favori par defaut.

import type { O05Project } from "./types";

export type FavoriResolverInput = {
  home_team_id: number;
  away_team_id: number;
  home_project: Pick<O05Project, "category" | "avg_rank_historical"> | null;
  away_project: Pick<O05Project, "category" | "avg_rank_historical"> | null;
};

export type FavoriResolverResult = {
  target_team_id: number;       // l'equipe cible (favori intrinseque)
  target_role: "home" | "away"; // home ou away
  opponent_team_id: number;     // l'adversaire
  reason: string;               // raison textuelle (debug + audit)
};


// ─── Hierarchie des categories ────────────────────────────────────

const CATEGORY_RANK: Record<string, number> = {
  ELITE: 5,
  EUROPE: 4,
  AMBITIEUX: 3,
  MILIEU: 2,
  MAINTIEN: 1,
};

const getCategoryRank = (category: string | null | undefined): number => {
  if (!category) return 0; // pas de projet = rang nul
  return CATEGORY_RANK[category] ?? 0;
};


// ─── Resolver principal ───────────────────────────────────────────

/**
 * Identifie le favori intrinseque entre les 2 equipes d'un match.
 *
 * Levee d'exception si AUCUNE des 2 equipes n'a de projet en DB
 * (= championnat non couvert, devrait etre filtre en amont).
 */
export const resolveFavoriIntrinseque = (
  input: FavoriResolverInput
): FavoriResolverResult => {
  const { home_team_id, away_team_id, home_project, away_project } = input;

  // Cas degrade : aucune des 2 equipes n'a de projet
  if (!home_project && !away_project) {
    throw new Error(
      "Aucune des deux equipes n'a de PROJET en DB. Le championnat doit etre seede avant analyse."
    );
  }

  // Cas semi-degrade : une seule equipe a un projet -> on prend celle qui a un projet
  // (probable equipe promue/reléguée, mais on ne devrait pas arriver ici si on filtre bien)
  if (!home_project && away_project) {
    return {
      target_team_id: away_team_id,
      target_role: "away",
      opponent_team_id: home_team_id,
      reason: "Domicile sans PROJET (probable promu), exterieur favori par defaut",
    };
  }
  if (home_project && !away_project) {
    return {
      target_team_id: home_team_id,
      target_role: "home",
      opponent_team_id: away_team_id,
      reason: "Exterieur sans PROJET (probable promu), domicile favori par defaut",
    };
  }

  // Cas nominal : les 2 ont un PROJET
  const homeRank = getCategoryRank(home_project!.category);
  const awayRank = getCategoryRank(away_project!.category);

  // Etape 1 : comparer categories
  if (homeRank > awayRank) {
    return {
      target_team_id: home_team_id,
      target_role: "home",
      opponent_team_id: away_team_id,
      reason: `Categorie superieure (${home_project!.category} > ${away_project!.category})`,
    };
  }
  if (awayRank > homeRank) {
    return {
      target_team_id: away_team_id,
      target_role: "away",
      opponent_team_id: home_team_id,
      reason: `Categorie superieure (${away_project!.category} > ${home_project!.category})`,
    };
  }

  // Etape 2 : meme categorie, comparer avg_rank_historical (plus basse = plus forte)
  const homeAvg = home_project!.avg_rank_historical ?? 21;
  const awayAvg = away_project!.avg_rank_historical ?? 21;

  if (homeAvg < awayAvg) {
    return {
      target_team_id: home_team_id,
      target_role: "home",
      opponent_team_id: away_team_id,
      reason: `Meme categorie ${home_project!.category}, mais moyenne historique meilleure (${homeAvg} < ${awayAvg})`,
    };
  }
  if (awayAvg < homeAvg) {
    return {
      target_team_id: away_team_id,
      target_role: "away",
      opponent_team_id: home_team_id,
      reason: `Meme categorie ${away_project!.category}, mais moyenne historique meilleure (${awayAvg} < ${homeAvg})`,
    };
  }

  // Etape 3 : egalite parfaite -> avantage du terrain
  return {
    target_team_id: home_team_id,
    target_role: "home",
    opponent_team_id: away_team_id,
    reason: "Egalite parfaite, avantage du terrain (domicile favori)",
  };
};


/**
 * Calcule le bonus PROJET d'une equipe selon son ecart classement actuel
 * vs moyenne historique :
 *  - ecart >= 5  : +1   (sous-performe, devrait remonter)
 *  - ecart >= 2  : +0.5 (legerement sous-performante)
 *  - ecart <= -4 : -0.5 (sur-performe, possible rechute)
 *  - sinon       : 0
 *
 * Note : ce bonus s'applique a l'attaque de la cible (boost si cible
 * sous-performe = elle doit reagir) et inversement pour la defense de
 * l'adversaire.
 */
export const computeProjectBonus = (
  current_rank: number | null | undefined,
  avg_rank_historical: number | null | undefined
): number => {
  if (current_rank == null || avg_rank_historical == null) return 0;
  const gap = current_rank - avg_rank_historical;
  if (gap >= 5) return 1.0;
  if (gap >= 2) return 0.5;
  if (gap <= -4) return -0.5;
  return 0;
};