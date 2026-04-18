/**
 * ═══════════════════════════════════════════════════════════════════
 * PROMPTS IA — Pronos IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Contient :
 *  - Le SYSTEM prompt qui définit les règles strictes de Claude
 *  - Le USER prompt généré dynamiquement avec les données du jour
 *  - Les types pour structurer les données envoyées
 *
 * C'est LA pièce maîtresse du projet. Tout ajustement de comportement
 * de l'IA passe par ici.
 * ═══════════════════════════════════════════════════════════════════
 */

import type { NormalizedMatch } from "./espn-matches";
import type { MatchWithOdds } from "./odds-api-client";


// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════

export const AI_PICKS_SYSTEM_PROMPT = `Tu es un analyseur sportif automatisé pour PRONOS.CLUB.

Ton rôle : analyser les matchs du jour et sélectionner les pronostics les plus intéressants selon des critères STRICTS.

# RÈGLES ABSOLUES (aucune exception)

## 1. Fourchette de cotes
Tu ne sélectionnes QUE des picks dont la cote EST entre **1.50 et 3.00 inclus**.
Cote < 1.50 ou > 3.00 = pick rejeté, même s'il est excellent.

## 2. Volume maximal
- **Max 5 pronos classiques** par jour (1N2, Over/Under 2.5, BTTS, vainqueur, totals)
- **Max 3 pronos buteurs** par jour (foot uniquement)
- Si tu n'as PAS assez de picks de qualité : tu en sors MOINS. Mieux vaut 2 picks solides que 5 douteux.
- Si aucun match ne satisfait tes critères : retourne des tableaux vides.

## 3. Diversité
- Varie les marchés (pas 5 fois du "h2h" si tu peux faire 2 h2h + 2 ou25 + 1 btts).
- Varie les sports si possible (ne concentre pas tout sur un seul).
- Évite 2 picks sur le même match (sauf 1 classique + 1 buteur OK).

## 4. Marchés autorisés

Foot :
- \`h2h\` : 1N2 (victoire home, nul, victoire away)
- \`ou25\` : Over/Under 2.5 buts
- \`btts\` : Both Teams To Score (les 2 équipes marquent)
- Buteur : joueur qui marquera (section scorers)

Tennis :
- \`h2h\` : vainqueur du match

Basket :
- \`h2h\` : vainqueur
- \`totals\` : Over/Under points (ligne précisée)

## 5. Pronos buteurs (section scorers)
- Foot UNIQUEMENT
- Mixer stars offensives en forme ET seconds couteaux avec stats récentes intéressantes
- Ne pas mettre uniquement des Mbappé/Haaland — varier pour rendre le contenu intéressant
- Basé sur : buts récents, forme, adversaire, temps de jeu probable

# MÉTHODE D'ANALYSE

Pour chaque match, tu dois évaluer :
1. **Forme récente** (bilan 5 derniers matchs si dispo)
2. **Cohérence des cotes** (une cote anormalement basse ou haute est souvent un signal)
3. **Contexte** (fatigue, rotation, enjeu du match, niveau de compétition)
4. **Value** : la cote reflète-t-elle la vraie probabilité, ou y a-t-il un écart exploitable ?

# JUSTIFICATION

Pour CHAQUE pick, écris UNE SEULE phrase factuelle et sobre, **MAX 120 caractères**.
Pas de sensationnalisme. Pas de "mise énorme", "pari sûr", "coup garanti".
Bons exemples :
- "PSG sur 4 victoires, Lens privé de son milieu créatif."
- "Alcaraz solide sur terre, Struff peu à l'aise dans ce format."
- "Défenses friables des deux côtés, Over 2.5 logique."

Mauvais exemples (ne pas faire) :
- "C'est gagné d'avance !!"
- "Pari 100% safe avec cote intéressante."
- "Mise importante recommandée."

# FORMAT DE SORTIE — STRICT

Tu réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans markdown fences.

Structure exacte :

{
  "classics": [
    {
      "event_name": "PSG vs Lens",
      "sport": "soccer",
      "league": "soccer_france_ligue_one",
      "event_date": "2026-04-18T19:45:00Z",
      "espn_event_id": "727643",
      "market": "h2h",
      "selection": "Paris Saint-Germain",
      "odds": 1.72,
      "reasoning": "PSG sur 4 victoires, Lens privé de son milieu créatif.",
      "confidence": 8
    }
  ],
  "scorers": [
    {
      "event_name": "PSG vs Lens",
      "league": "soccer_france_ligue_one",
      "event_date": "2026-04-18T19:45:00Z",
      "espn_event_id": "727643",
      "player_name": "Kylian Mbappé",
      "reasoning": "4 buts sur 3 derniers matchs, Lens défense friable à l'extérieur.",
      "confidence": 7
    }
  ]
}

Si aucun pick ne passe tes critères :
{ "classics": [], "scorers": [] }

# RÈGLES D'INTÉGRITÉ

- Pour "selection" dans h2h foot : utiliser le NOM EXACT de l'équipe tel qu'il apparaît dans les données ("Paris Saint-Germain" pas "PSG").
- Pour "selection" dans ou25 : écrire "Over 2.5" ou "Under 2.5".
- Pour "selection" dans btts : écrire "Yes" ou "No".
- Pour "selection" dans totals (basket) : écrire "Over 225.5" (avec la ligne exacte fournie).
- Pour les cotes : prendre celle du bookmaker qui donne le meilleur prix dans ta fourchette 1.50-3.00.
- Pour espn_event_id : utiliser celui fourni dans les données, ou null si absent.
- Pour event_date : format ISO 8601 UTC strict (ex: "2026-04-18T19:45:00Z").

# RAPPEL FINAL

Tu es un outil expérimental, pas un oracle. Privilégie la qualité à la quantité. La transparence de tes résultats (gagnants ET perdants) est affichée publiquement, donc chaque pick douteux est visible. Sélectionne comme si c'était tes propres mises.`;


// ═══════════════════════════════════════════════════════════════════
// FORMAT DES DONNÉES ENVOYÉES
// ═══════════════════════════════════════════════════════════════════

/**
 * Format agrégé ESPN + Odds API pour un match, prêt à être envoyé à l'IA.
 * C'est ce qui est injecté dans le user prompt.
 */
export interface EnrichedMatch {
  espn_event_id: string | null;
  league: string;
  sport: "soccer" | "tennis" | "basketball";
  event_name: string;
  event_date: string;  // ISO UTC
  home_team: string;
  away_team: string;
  /** Cotes agrégées par bookmaker */
  odds: {
    bookmaker: string;
    markets: {
      h2h?: { home?: number; draw?: number; away?: number };
      totals?: Array<{ point: number; over: number; under: number }>;
      btts?: { yes?: number; no?: number };
    };
  }[];
  /** Forme récente des équipes si disponible (ex: "WWLDW") */
  home_form?: string;
  away_form?: string;
}


// ═══════════════════════════════════════════════════════════════════
// CONSTRUCTION DU USER PROMPT
// ═══════════════════════════════════════════════════════════════════

/**
 * Construit le user prompt avec toutes les données des matchs du jour.
 * Le prompt reste compact pour économiser les tokens.
 */
export function buildUserPrompt(matches: EnrichedMatch[]): string {
  const today = new Date().toISOString().split("T")[0];
  const matchCount = matches.length;

  if (matchCount === 0) {
    return `Date : ${today}

Aucun match éligible aujourd'hui. Retourne :
{ "classics": [], "scorers": [] }`;
  }

  // On sérialise les matchs en JSON compact (moins de tokens)
  const matchesJson = JSON.stringify(matches, null, 2);

  return `Date du jour : ${today}

Voici ${matchCount} match${matchCount > 1 ? "s" : ""} éligible${matchCount > 1 ? "s" : ""} à analyser, avec leurs cotes agrégées :

\`\`\`json
${matchesJson}
\`\`\`

Analyse ces matchs selon tes règles et retourne tes sélections en JSON strict.

Rappel des contraintes :
- Cotes entre 1.50 et 3.00 inclus (strict)
- Max 5 classiques + Max 3 buteurs
- Qualité > quantité : sors MOINS si rien ne te convainc vraiment
- Varier sports et marchés`;
}


// ═══════════════════════════════════════════════════════════════════
// HELPER : fusionne un match ESPN avec ses cotes Odds API
// ═══════════════════════════════════════════════════════════════════

import { matchesEspnAndOdds } from "./odds-api-client";

/**
 * Prend un match ESPN et cherche les cotes correspondantes dans The Odds API.
 * Retourne un EnrichedMatch prêt pour le prompt.
 */
export function enrichMatchWithOdds(
  espnMatch: NormalizedMatch,
  allOddsMatches: MatchWithOdds[],
): EnrichedMatch {
  // Chercher le match Odds correspondant via fuzzy matching
  const oddsMatch = allOddsMatches.find((o) =>
    matchesEspnAndOdds(
      espnMatch.homeTeam,
      espnMatch.awayTeam,
      o.home_team,
      o.away_team,
    ),
  );

  const odds: EnrichedMatch["odds"] = [];

  if (oddsMatch) {
    for (const bookmaker of oddsMatch.bookmakers) {
      const markets: EnrichedMatch["odds"][number]["markets"] = {};

      // h2h
      if (bookmaker.markets.h2h) {
        const h2h: { home?: number; draw?: number; away?: number } = {};
        for (const outcome of bookmaker.markets.h2h) {
          // Matcher par nom (home_team / away_team / "Draw")
          if (outcome.name === oddsMatch.home_team) h2h.home = outcome.price;
          else if (outcome.name === oddsMatch.away_team) h2h.away = outcome.price;
          else if (outcome.name.toLowerCase().includes("draw")) h2h.draw = outcome.price;
        }
        if (Object.keys(h2h).length > 0) markets.h2h = h2h;
      }

      // totals (Over/Under)
      if (bookmaker.markets.totals && bookmaker.markets.totals.length > 0) {
        const totalsByPoint: Record<
          number,
          { point: number; over?: number; under?: number }
        > = {};

        for (const outcome of bookmaker.markets.totals) {
          if (!totalsByPoint[outcome.point]) {
            totalsByPoint[outcome.point] = { point: outcome.point };
          }
          if (outcome.name.toLowerCase().includes("over")) {
            totalsByPoint[outcome.point].over = outcome.price;
          } else if (outcome.name.toLowerCase().includes("under")) {
            totalsByPoint[outcome.point].under = outcome.price;
          }
        }

        markets.totals = Object.values(totalsByPoint)
          .filter((t) => t.over && t.under)
          .map((t) => ({
            point: t.point,
            over: t.over as number,
            under: t.under as number,
          }));
      }

      // btts
      if (bookmaker.markets.btts) {
        const btts: { yes?: number; no?: number } = {};
        for (const outcome of bookmaker.markets.btts) {
          if (outcome.name.toLowerCase() === "yes") btts.yes = outcome.price;
          else if (outcome.name.toLowerCase() === "no") btts.no = outcome.price;
        }
        if (Object.keys(btts).length > 0) markets.btts = btts;
      }

      if (Object.keys(markets).length > 0) {
        odds.push({
          bookmaker: bookmaker.key,
          markets,
        });
      }
    }
  }

  return {
    espn_event_id: espnMatch.espnEventId,
    league: espnMatch.league,
    sport: espnMatch.sport,
    event_name: `${espnMatch.homeTeam} vs ${espnMatch.awayTeam}`,
    event_date: espnMatch.eventDate,
    home_team: espnMatch.homeTeam,
    away_team: espnMatch.awayTeam,
    odds,
    home_form: espnMatch.homeForm,
    away_form: espnMatch.awayForm,
  };
}