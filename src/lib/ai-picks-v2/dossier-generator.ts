import type {
  AggregatedMatchData,
} from "@/types/apifootball";
import type {
  ConsensusCandidate,
  DossierResult,
  GeneratorMeta,
} from "@/types/ai-picks-v2";
import { runClaudeDossier } from "./anthropic-client";
import {
  buildDossierUserPrompt,
  DOSSIER_SYSTEM_PROMPT,
} from "./prompts";

export type GenerateDossierInput = {
  pick: ConsensusCandidate;
  matchData: AggregatedMatchData | null;
  pickId?: string | null;
};

const summarizeFormFromString = (form: string | null | undefined): string => {
  if (!form) return "non disponible";
  const last10 = form.slice(-10);
  const wins = (last10.match(/W/g) ?? []).length;
  const draws = (last10.match(/D/g) ?? []).length;
  const losses = (last10.match(/L/g) ?? []).length;
  return `${last10} (${wins}V ${draws}N ${losses}D sur les 10 derniers)`;
};

const buildPickSummary = (pick: ConsensusCandidate): string => {
  if (pick.type === "classic") {
    return `**Type**: Pick classique
**Match**: ${pick.eventName}
**Compétition**: ${pick.league}
**Date**: ${pick.eventDateIso}
**Marché**: ${pick.market ?? "?"}
**Sélection**: ${pick.selection}
**Cote**: ${pick.odds} chez ${pick.bookmaker ?? "bookmaker non spécifié"}
**Score consensus**: ${pick.consensusScore}/100 (tier: ${pick.consensusTier})`;
  }
  return `**Type**: Pick buteur
**Match**: ${pick.eventName}
**Compétition**: ${pick.league}
**Date**: ${pick.eventDateIso}
**Joueur**: ${pick.player ?? pick.selection}
**Équipe**: ${pick.team ?? "?"}
**Cote estimée**: ${pick.odds}
**Score consensus**: ${pick.consensusScore}/100 (tier: ${pick.consensusTier})`;
};

const buildMatchDataSummary = (
  matchData: AggregatedMatchData | null
): string => {
  if (!matchData) {
    return "Données détaillées API-Football non disponibles pour ce match. Utilise tes connaissances générales du sport et des équipes/joueurs concernés.";
  }

  const f = matchData.fixture;
  const homeStats = matchData.homeStats;
  const awayStats = matchData.awayStats;
  const lineups = matchData.lineups ?? [];
  const injuries = matchData.injuries ?? [];
  const h2h = matchData.h2h ?? [];
  const predictions = matchData.predictions;

  const sections: string[] = [];

  sections.push(
    `### Métadonnées du match
- **Compétition**: ${f.league.country} - ${f.league.name} (${f.league.round})
- **Saison**: ${f.league.season}
- **Stade**: ${f.fixture.venue.name ?? "?"} (${f.fixture.venue.city ?? "?"})
- **Arbitre**: ${f.fixture.referee ?? "non communiqué"}
- **Coup d'envoi**: ${f.fixture.date}`
  );

  if (homeStats) {
    sections.push(
      `### Forme ${homeStats.team.name} (domicile)
- Forme récente: ${summarizeFormFromString(homeStats.form)}
- Matchs joués: ${homeStats.fixtures.played.total} (${homeStats.fixtures.played.home} dom / ${homeStats.fixtures.played.away} ext)
- Victoires/Nuls/Défaites: ${homeStats.fixtures.wins.total}V ${homeStats.fixtures.draws.total}N ${homeStats.fixtures.loses.total}D
- Buts pour: ${homeStats.goals.for.total.total} (moyenne ${homeStats.goals.for.average.total}/match)
- Buts contre: ${homeStats.goals.against.total.total} (moyenne ${homeStats.goals.against.average.total}/match)
- Clean sheets: ${homeStats.clean_sheet.total}
- N'a pas marqué: ${homeStats.failed_to_score.total}x`
    );
  }

  if (awayStats) {
    sections.push(
      `### Forme ${awayStats.team.name} (extérieur)
- Forme récente: ${summarizeFormFromString(awayStats.form)}
- Matchs joués: ${awayStats.fixtures.played.total} (${awayStats.fixtures.played.home} dom / ${awayStats.fixtures.played.away} ext)
- Victoires/Nuls/Défaites: ${awayStats.fixtures.wins.total}V ${awayStats.fixtures.draws.total}N ${awayStats.fixtures.loses.total}D
- Buts pour: ${awayStats.goals.for.total.total} (moyenne ${awayStats.goals.for.average.total}/match)
- Buts contre: ${awayStats.goals.against.total.total} (moyenne ${awayStats.goals.against.average.total}/match)
- Clean sheets: ${awayStats.clean_sheet.total}
- N'a pas marqué: ${awayStats.failed_to_score.total}x`
    );
  }

  if (h2h.length > 0) {
    const recent = h2h.slice(0, 5);
    const lines = recent.map((m) => {
      const date = m.fixture.date.slice(0, 10);
      const home = m.teams.home.name;
      const away = m.teams.away.name;
      const score = `${m.goals.home ?? "?"}-${m.goals.away ?? "?"}`;
      return `- ${date}: ${home} ${score} ${away}`;
    });
    sections.push(`### Confrontations directes (5 dernières)
${lines.join("\n")}`);
  }

  if (lineups.length > 0) {
    const lineupTexts = lineups.map((l) => {
      const startNames = l.startXI
        .slice(0, 11)
        .map((s) => s.player.name)
        .join(", ");
      return `**${l.team.name}** (${l.formation ?? "?"}): ${startNames}`;
    });
    sections.push(`### Compositions probables
${lineupTexts.join("\n\n")}`);
  } else {
    sections.push(
      `### Compositions probables
Compositions non encore publiées (souvent ~1h avant le coup d'envoi).`
    );
  }

  if (injuries.length > 0) {
    const injLines = injuries.slice(0, 10).map((i) => {
      return `- ${i.team.name} – ${i.player.name} (${i.player.type ?? "?"} – ${i.player.reason ?? "?"})`;
    });
    sections.push(`### Blessures et suspensions
${injLines.join("\n")}`);
  }

  if (predictions) {
    const p = predictions.predictions;
    sections.push(
      `### Prédictions API-Football (algorithmiques)
- Vainqueur estimé: ${p.winner.name ?? "indécis"} ${p.winner.comment ? `(${p.winner.comment})` : ""}
- Probabilités: ${p.percent.home} domicile / ${p.percent.draw} nul / ${p.percent.away} extérieur
- Conseil: ${p.advice ?? "aucun"}
- Total buts attendu: ${p.under_over ?? "non précisé"}`
    );
  }

  return sections.join("\n\n");
};

const buildConsensusInfo = (pick: ConsensusCandidate): string => {
  const parts: string[] = [];
  parts.push(`**Score consensus**: ${pick.consensusScore}/100`);
  parts.push(`**Niveau**: ${pick.consensusTier}`);
  parts.push(`**Source**: ${pick.source}`);

  if (pick.confidenceClaude !== null) {
    parts.push(`**Confiance Claude**: ${pick.confidenceClaude}/100`);
    if (pick.reasoningClaude) {
      parts.push(`**Raisonnement Claude**: ${pick.reasoningClaude}`);
    }
  }

  if (pick.confidenceGpt !== null) {
    parts.push(`**Confiance GPT**: ${pick.confidenceGpt}/100`);
    if (pick.reasoningGpt) {
      parts.push(`**Raisonnement GPT**: ${pick.reasoningGpt}`);
    }
  }

  if (pick.confidenceApiFootball !== null) {
    parts.push(
      `**Probabilité API-Football**: ${pick.confidenceApiFootball}% sur cette sélection`
    );
  }

  return parts.join("\n");
};

const tryParseDossierJson = (text: string): unknown | null => {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

export const generateDossier = async (
  input: GenerateDossierInput
): Promise<DossierResult> => {
  const pickSummary = buildPickSummary(input.pick);
  const matchDataSummary = buildMatchDataSummary(input.matchData);
  const consensusInfo = buildConsensusInfo(input.pick);

  const userPrompt = buildDossierUserPrompt(
    pickSummary,
    matchDataSummary,
    consensusInfo
  );

  const result = await runClaudeDossier({
    systemPrompt: DOSSIER_SYSTEM_PROMPT,
    userPrompt,
    pickId: input.pickId ?? null,
    maxTokens: 4500,
  });

  const meta: GeneratorMeta = {
    model: result.model,
    provider: "anthropic",
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    tokensCached: result.tokensCached,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
  };

  if (result.error || !result.text) {
    return {
      sections: null,
      fullText: result.text,
      meta,
      error: result.error ?? "Empty dossier text",
    };
  }

  const parsed = tryParseDossierJson(result.text);
  if (!parsed || typeof parsed !== "object") {
    return {
      sections: null,
      fullText: result.text,
      meta,
      error: "Failed to parse dossier JSON",
    };
  }

  const obj = parsed as Record<string, unknown>;
  const sections = {
    context_match: String(obj.context_match ?? ""),
    form_analysis: String(obj.form_analysis ?? ""),
    h2h_analysis: String(obj.h2h_analysis ?? ""),
    lineups_and_injuries: String(obj.lineups_and_injuries ?? ""),
    tactical_analysis: String(obj.tactical_analysis ?? ""),
    ai_consensus_explanation: String(obj.ai_consensus_explanation ?? ""),
    conclusion: String(obj.conclusion ?? ""),
  };

  return {
    sections,
    fullText: result.text,
    meta,
  };
};