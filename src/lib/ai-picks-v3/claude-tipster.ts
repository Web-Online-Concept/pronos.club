/**
 * PRONOS.CLUB — Claude Tipster (v3)
 *
 * Appelle Claude Sonnet 4.6 avec la prompt v2.2 et la data multi-sports enrichie.
 * Parse le JSON output (Bloc 2) et conserve le narratif français (Bloc 1).
 *
 * Modèle : claude-sonnet-4-5 (alias commercial 4.6 = "claude-sonnet-4-5")
 * Coût estimé : ~5-8€/mois pour 1 appel/jour avec ~200KB de data en input.
 *
 * Output : TipsterResult avec :
 *   - output: TipsterOutput parsé (1-10 picks au format JSON strict)
 *   - narrative_text: bloc 1 français (utile pour persister un dossier)
 *   - meta: tokens + coût + durée
 *   - error: string si parsing/appel a foiré
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  TIPSTER_SYSTEM_PROMPT,
  buildTipsterUserPrompt,
} from "./tipster-prompt";
import type {
  FetchOutput,
  TipsterOutput,
  TipsterResult,
  TipsterCallMeta,
} from "./tipster-types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

/**
 * Modèle Claude utilisé pour le tipster.
 * Sonnet 4.6 = meilleur compromis qualité / coût pour ce use case.
 *
 * Pour switcher temporairement en Opus (test qualité), passer la variable d'env :
 *   CLAUDE_TIPSTER_MODEL="claude-opus-4-5"
 */
const CLAUDE_MODEL =
  process.env.CLAUDE_TIPSTER_MODEL ?? "claude-sonnet-4-5";

/**
 * Limite de tokens output. Une réponse complète (analyse + JSON) tourne autour
 * de 4000-6000 tokens. On met large pour ne jamais tronquer.
 */
const MAX_TOKENS = 8000;

/**
 * Tarifs API Anthropic (USD / 1M tokens) — Claude Sonnet 4.6.
 * Source : https://docs.claude.com/en/docs/build-with-claude/pricing
 *
 * À mettre à jour si Anthropic révise sa grille tarifaire.
 */
const PRICING_INPUT_PER_MTOK = 3.0;
const PRICING_OUTPUT_PER_MTOK = 15.0;
const PRICING_CACHE_READ_PER_MTOK = 0.3;

// ============================================================================
// RÈGLES MÉTIER — SEUILS (centralisés ici pour cohérence avec gpt-validator)
// ============================================================================

/** Cote minimum ABSOLUE pour un pick simple (règle publique PRONOS.CLUB) */
const MIN_COTE_SIMPLE = 1.50;
/** Cote maximum pour un pick simple */
const MAX_COTE_SIMPLE = 3.50;
/** Cote minimum par sélection dans un combiné */
const MIN_COTE_SELECTION_COMBINE = 1.30;
/** Cote totale minimum pour un combiné */
const MIN_COTE_TOTALE_COMBINE = 1.50;
/** Cote totale maximum pour un combiné */
const MAX_COTE_TOTALE_COMBINE = 4.00;
/**
 * Écart maximum toléré entre cote_arjel et cote_hors_arjel (en ratio).
 * Au-delà de 30%, on considère qu'il y a une hallucination Claude.
 * Ex : 1.14 vs 2.36 = écart 107% → rejet.
 */
const MAX_ECART_ARJEL_HORS_ARJEL = 0.30;

// ============================================================================
// CLIENT ANTHROPIC (lazy init)
// ============================================================================

let _anthropicClient: Anthropic | null = null;

const getAnthropicClient = (): Anthropic => {
  if (!_anthropicClient) {
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable not set");
    }
    _anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return _anthropicClient;
};

// ============================================================================
// PARSING DU JSON OUTPUT
// ============================================================================

/**
 * Extrait le JSON output du texte renvoyé par Claude.
 *
 * Stratégie de parsing :
 *   1. Cherche un bloc ```json...``` (format markdown attendu)
 *   2. Sinon, cherche le dernier objet JSON `{` ... `}` dans le texte
 *   3. Parse et valide la structure
 *
 * Lance une erreur si parsing impossible ou structure invalide.
 */
const extractJsonOutput = (text: string): TipsterOutput => {
  // Tentative 1 : bloc ```json...```
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  let jsonStr: string | null = null;

  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonStr = jsonBlockMatch[1].trim();
  } else {
    // Tentative 2 : dernier objet JSON dans le texte
    // On cherche le DERNIER `{` puis on tente de parser jusqu'à la fin équilibrée
    const lastOpenBrace = text.lastIndexOf('"date"');
    if (lastOpenBrace !== -1) {
      // Reculer jusqu'au { qui contient ce "date"
      const before = text.substring(0, lastOpenBrace);
      const lastBrace = before.lastIndexOf("{");
      if (lastBrace !== -1) {
        // Trouver le } correspondant en comptant les niveaux
        let depth = 0;
        let endIdx = -1;
        for (let i = lastBrace; i < text.length; i++) {
          if (text[i] === "{") depth++;
          else if (text[i] === "}") {
            depth--;
            if (depth === 0) {
              endIdx = i;
              break;
            }
          }
        }
        if (endIdx !== -1) {
          jsonStr = text.substring(lastBrace, endIdx + 1);
        }
      }
    }
  }

  if (!jsonStr) {
    throw new Error("Aucun JSON output détectable dans la réponse Claude");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(
      `JSON parsing failed: ${(err as Error).message}. JSON snippet: ${jsonStr.substring(0, 200)}`
    );
  }

  // Validation structurelle minimale
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("date" in parsed) ||
    !("nb_pronos" in parsed) ||
    !("pronostics" in parsed)
  ) {
    throw new Error(
      "JSON structure invalide : champs date/nb_pronos/pronostics manquants"
    );
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.pronostics)) {
    throw new Error("pronostics n'est pas un array");
  }

  return parsed as TipsterOutput;
};

/**
 * Extrait le narratif français (Bloc 1) en retirant le bloc JSON final.
 * Utile pour persister un texte pré-rédigé pour les abonnés ou pour les dossiers.
 */
const extractNarrativeText = (text: string): string => {
  // Retire le bloc ```json...```
  const cleaned = text.replace(/```json\s*[\s\S]*?\s*```/g, "").trim();
  return cleaned;
};

// ============================================================================
// VALIDATION PICKS POST-PARSING (sanity checks + règles métier)
// ============================================================================

/**
 * Valide la structure de chaque pick ET applique les règles métier strictes.
 *
 * ═══════════════════════════════════════════════════════════════
 * FIXES A1 + B1 (session 02/05/2026) :
 *
 * A1 — Filtres cotes minimum/maximum (rejet automatique) :
 *   - Simple : meilleure cote (max arjel/hors_arjel) doit être ≥ 1.50 et ≤ 3.50
 *   - Combiné par sélection : chaque cote doit être ≥ 1.30
 *   - Combiné total : meilleure cote totale doit être ≥ 1.50 et ≤ 4.00
 *
 * B1 — Filtre cohérence ARJEL/hors_ARJEL (rejet si hallucination probable) :
 *   - Si écart entre cote_arjel et cote_hors_arjel > 30%, pick rejeté
 *   - Un écart de 107% (ex: 1.14 vs 2.36) est physiquement impossible
 *   - S'applique aux simples (arjel/hors_arjel) et aux combinés (cote_totale_*)
 * ═══════════════════════════════════════════════════════════════
 *
 * Auto-fix : si mise_unites != 1, forcée à 1 (flat bet obligatoire).
 *
 * Logs warnings pour traçabilité, ne lance pas d'erreur.
 */
const validateAndFixPicks = (output: TipsterOutput): TipsterOutput => {
  const validPicks = output.pronostics.filter((pick, idx) => {
    if (typeof pick.id !== "number") {
      console.warn(`[claude-tipster] Pick #${idx} sans id numérique, ignoré`);
      return false;
    }

    if (typeof pick.confiance !== "number") {
      console.warn(`[claude-tipster] Pick #${pick.id} sans confiance numérique, ignoré`);
      return false;
    }

    // ── PICK SIMPLE ──────────────────────────────────────────────────────────
    if (pick.type === "simple") {
      // Confiance [65, 100]
      if (pick.confiance < 65 || pick.confiance > 100) {
        console.warn(
          `[claude-tipster] Pick simple #${pick.id} confiance ${pick.confiance} hors [65,100], ignoré`
        );
        return false;
      }

      // Au moins une cote présente
      if (
        (pick.cote_arjel === null || pick.cote_arjel === undefined) &&
        (pick.cote_hors_arjel === null || pick.cote_hors_arjel === undefined)
      ) {
        console.warn(
          `[claude-tipster] Pick simple #${pick.id} sans aucune cote, ignoré`
        );
        return false;
      }

      // FIX A1 — Cote min 1.50, max 3.50 (sur la MEILLEURE cote disponible)
      const bestCote = Math.max(
        pick.cote_arjel ?? 0,
        pick.cote_hors_arjel ?? 0
      );
      if (bestCote < MIN_COTE_SIMPLE) {
        console.warn(
          `[claude-tipster] Pick simple #${pick.id} meilleure cote ${bestCote} < ${MIN_COTE_SIMPLE} (règle absolue), rejeté`
        );
        return false;
      }
      if (bestCote > MAX_COTE_SIMPLE) {
        console.warn(
          `[claude-tipster] Pick simple #${pick.id} meilleure cote ${bestCote} > ${MAX_COTE_SIMPLE}, rejeté`
        );
        return false;
      }

      // FIX B1 — Écart ARJEL/hors_ARJEL > 30% = hallucination probable
      if (
        pick.cote_arjel != null &&
        pick.cote_hors_arjel != null &&
        pick.cote_arjel > 0 &&
        pick.cote_hors_arjel > 0
      ) {
        const higher = Math.max(pick.cote_arjel, pick.cote_hors_arjel);
        const lower = Math.min(pick.cote_arjel, pick.cote_hors_arjel);
        const ecart = (higher - lower) / lower;
        if (ecart > MAX_ECART_ARJEL_HORS_ARJEL) {
          console.warn(
            `[claude-tipster] Pick simple #${pick.id} écart ARJEL/hors_ARJEL ${(ecart * 100).toFixed(1)}% > ${MAX_ECART_ARJEL_HORS_ARJEL * 100}% (hallucination probable : ${pick.cote_arjel} vs ${pick.cote_hors_arjel}), rejeté`
          );
          return false;
        }
      }

    // ── PICK COMBINÉ ─────────────────────────────────────────────────────────
    } else if (pick.type === "combine") {
      // Confiance [70, 100]
      if (pick.confiance < 70 || pick.confiance > 100) {
        console.warn(
          `[claude-tipster] Pick combiné #${pick.id} confiance ${pick.confiance} hors [70,100], ignoré`
        );
        return false;
      }

      // 2 sélections exactement
      if (
        !Array.isArray(pick.selections) ||
        pick.selections.length < 2 ||
        pick.selections.length > 2
      ) {
        console.warn(
          `[claude-tipster] Pick combiné #${pick.id} avec ${pick.selections?.length} sélection(s) (attendu: 2), ignoré`
        );
        return false;
      }

      // FIX A1 — Chaque sélection doit avoir cote ≥ 1.30
      for (const sel of pick.selections) {
        const selCote = (sel as { cote?: number }).cote;
        if (typeof selCote !== "number" || selCote < MIN_COTE_SELECTION_COMBINE) {
          console.warn(
            `[claude-tipster] Pick combiné #${pick.id} — sélection "${(sel as { match?: string }).match ?? "?"}" cote ${selCote ?? "undefined"} < ${MIN_COTE_SELECTION_COMBINE}, combiné entier rejeté`
          );
          return false;
        }
      }

      // FIX A1 — Cote totale : meilleure entre arjel/hors_arjel doit être dans [1.50, 4.00]
      const combine = pick as unknown as {
        cote_totale_arjel?: number | null;
        cote_totale_hors_arjel?: number | null;
      };
      const bestTotalCote = Math.max(
        combine.cote_totale_arjel ?? 0,
        combine.cote_totale_hors_arjel ?? 0
      );
      if (bestTotalCote === 0) {
        console.warn(
          `[claude-tipster] Pick combiné #${pick.id} sans cote totale, ignoré`
        );
        return false;
      }
      if (bestTotalCote < MIN_COTE_TOTALE_COMBINE) {
        console.warn(
          `[claude-tipster] Pick combiné #${pick.id} cote totale ${bestTotalCote} < ${MIN_COTE_TOTALE_COMBINE}, rejeté`
        );
        return false;
      }
      if (bestTotalCote > MAX_COTE_TOTALE_COMBINE) {
        console.warn(
          `[claude-tipster] Pick combiné #${pick.id} cote totale ${bestTotalCote} > ${MAX_COTE_TOTALE_COMBINE}, rejeté`
        );
        return false;
      }

      // FIX B1 — Écart entre cote_totale_arjel et cote_totale_hors_arjel > 30%
      if (
        combine.cote_totale_arjel != null &&
        combine.cote_totale_hors_arjel != null &&
        combine.cote_totale_arjel > 0 &&
        combine.cote_totale_hors_arjel > 0
      ) {
        const higher = Math.max(combine.cote_totale_arjel, combine.cote_totale_hors_arjel);
        const lower = Math.min(combine.cote_totale_arjel, combine.cote_totale_hors_arjel);
        const ecart = (higher - lower) / lower;
        if (ecart > MAX_ECART_ARJEL_HORS_ARJEL) {
          console.warn(
            `[claude-tipster] Pick combiné #${pick.id} écart cote totale ARJEL/hors_ARJEL ${(ecart * 100).toFixed(1)}% > ${MAX_ECART_ARJEL_HORS_ARJEL * 100}% (${combine.cote_totale_arjel} vs ${combine.cote_totale_hors_arjel}), rejeté`
          );
          return false;
        }
      }

    // ── TYPE INCONNU ──────────────────────────────────────────────────────────
    } else {
      const unknownPick = pick as { id?: number; type?: string };
      console.warn(
        `[claude-tipster] Pick #${unknownPick.id ?? "?"} type "${unknownPick.type ?? "?"}" non supporté, ignoré`
      );
      return false;
    }

    // Auto-fix : si mise_unites != 1 (Claude pourrait avoir loupé la règle)
    if (pick.mise_unites !== 1) {
      console.warn(
        `[claude-tipster] Pick #${pick.id} mise_unites=${pick.mise_unites} forcée à 1 (flat bet)`
      );
      pick.mise_unites = 1;
    }

    return true;
  });

  const rejectedCount = output.pronostics.length - validPicks.length;
  if (rejectedCount > 0) {
    console.log(
      `[claude-tipster] validateAndFixPicks : ${rejectedCount} pick(s) rejeté(s) sur ${output.pronostics.length} (cotes/cohérence invalides)`
    );
  }

  return {
    ...output,
    nb_pronos: validPicks.length,
    pronostics: validPicks,
  };
};

// ============================================================================
// CALCUL DU COÛT
// ============================================================================

const computeCostUsd = (
  tokensInput: number,
  tokensOutput: number,
  tokensCached: number
): number => {
  const inputCost =
    ((tokensInput - tokensCached) * PRICING_INPUT_PER_MTOK) / 1_000_000;
  const cacheCost = (tokensCached * PRICING_CACHE_READ_PER_MTOK) / 1_000_000;
  const outputCost = (tokensOutput * PRICING_OUTPUT_PER_MTOK) / 1_000_000;
  return parseFloat((inputCost + cacheCost + outputCost).toFixed(6));
};

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Appelle Claude tipster avec la data enrichie et retourne le résultat parsé.
 *
 * Cas d'erreur :
 *   - Si l'appel API échoue (network, rate limit, etc.) → retourne TipsterResult avec error défini, output=null
 *   - Si le parsing JSON échoue → retourne TipsterResult avec error défini, output=null
 *   - Sinon → retourne TipsterResult avec output défini (peut contenir 0 picks si tout filtré)
 */
export const runClaudeTipster = async (
  fetchOutput: FetchOutput
): Promise<TipsterResult> => {
  const startedAt = Date.now();
  const todayIsoDate = fetchOutput.date_du_jour;

  // Construction du prompt user
  const fetchOutputJson = JSON.stringify(fetchOutput, null, 2);
  const userPrompt = buildTipsterUserPrompt(fetchOutputJson, todayIsoDate);

  let client: Anthropic;
  try {
    client = getAnthropicClient();
  } catch (err) {
    return {
      output: null,
      meta: {
        model: CLAUDE_MODEL,
        tokens_input: 0,
        tokens_output: 0,
        tokens_cached: 0,
        cost_usd: 0,
        duration_ms: Date.now() - startedAt,
      },
      error: (err as Error).message,
    };
  }

  // Appel API
  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: TIPSTER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    const meta: TipsterCallMeta = {
      model: CLAUDE_MODEL,
      tokens_input: 0,
      tokens_output: 0,
      tokens_cached: 0,
      cost_usd: 0,
      duration_ms: Date.now() - startedAt,
    };
    return {
      output: null,
      meta,
      error: `Anthropic API call failed: ${(err as Error).message}`,
    };
  }

  // Extraction des tokens et coût
  const tokensInput = response.usage.input_tokens;
  const tokensOutput = response.usage.output_tokens;
  const tokensCached = response.usage.cache_read_input_tokens ?? 0;
  const costUsd = computeCostUsd(tokensInput, tokensOutput, tokensCached);

  const meta: TipsterCallMeta = {
    model: CLAUDE_MODEL,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    tokens_cached: tokensCached,
    cost_usd: costUsd,
    duration_ms: Date.now() - startedAt,
  };

  // Extraction du texte (les content blocks Claude peuvent être text ou tool_use)
  const textBlocks = response.content.filter(
    (block): block is Anthropic.Messages.TextBlock => block.type === "text"
  );
  if (textBlocks.length === 0) {
    return {
      output: null,
      meta,
      error: "Réponse Claude sans bloc de texte",
    };
  }
  const fullText = textBlocks.map((b) => b.text).join("\n");

  // Parsing du JSON output
  let parsedOutput: TipsterOutput;
  try {
    parsedOutput = extractJsonOutput(fullText);
  } catch (err) {
    return {
      output: null,
      meta,
      error: `JSON extraction failed: ${(err as Error).message}`,
      narrative_text: extractNarrativeText(fullText),
    };
  }

  // Validation + auto-fix des picks (règles métier + cohérence cotes)
  const validated = validateAndFixPicks(parsedOutput);

  return {
    output: validated,
    meta,
    narrative_text: extractNarrativeText(fullText),
  };
};