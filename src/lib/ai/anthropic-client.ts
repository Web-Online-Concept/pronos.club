/**
 * ═══════════════════════════════════════════════════════════════════
 * ANTHROPIC CLIENT — Pronos IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Wrapper autour de l'API Anthropic (Claude) pour générer les pronos.
 *
 * Responsabilités :
 *  - Appel à l'API /v1/messages
 *  - Gestion d'erreurs (timeout, 429, 500, etc.)
 *  - Tracking des coûts (tokens input/output + USD estimé)
 *  - Parsing défensif de la réponse via schema Zod
 *
 * Documentation API : https://docs.anthropic.com/en/api/messages
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  AI_PICKS_SYSTEM_PROMPT,
  buildUserPrompt,
  type EnrichedMatch,
} from "./prompts";
import { parseAIResponse, type AIResponse } from "./schema";


// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** Modèle Claude utilisé. Sonnet = bon équilibre qualité/prix pour ce cas */
const MODEL = "claude-sonnet-4-6";

/** Max tokens de sortie (3000 suffit largement pour 5 picks + 3 buteurs + JSON) */
const MAX_OUTPUT_TOKENS = 3000;

/** Timeout de l'appel API (Claude peut être lent sur de gros prompts) */
const API_TIMEOUT_MS = 60000;

/** Prix Sonnet 4.6 en USD par million de tokens (référence : avril 2026) */
const PRICE_INPUT_PER_MTOKENS = 3.0;   // $3/1M tokens input
const PRICE_OUTPUT_PER_MTOKENS = 15.0; // $15/1M tokens output


// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/** Retour de l'appel Anthropic */
export interface AIGenerationResult {
  success: boolean;
  data?: AIResponse;
  errors?: string[];
  /** Métriques pour monitoring */
  metrics: {
    model: string;
    tokensInput: number;
    tokensOutput: number;
    tokensTotal: number;
    estimatedCostUsd: number;
    durationMs: number;
  };
  /** Réponse brute de Claude (pour audit/debug) */
  rawResponse?: string;
}

/** Format de la réponse Anthropic API */
interface AnthropicMessageResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}


// ═══════════════════════════════════════════════════════════════════
// FETCH HELPER AVEC TIMEOUT
// ═══════════════════════════════════════════════════════════════════

async function fetchAnthropic(
  apiKey: string,
  body: unknown,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timeout);
  }
}


// ═══════════════════════════════════════════════════════════════════
// CALCUL DES COÛTS
// ═══════════════════════════════════════════════════════════════════

function computeCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICE_INPUT_PER_MTOKENS;
  const outputCost = (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_MTOKENS;
  return inputCost + outputCost;
}


// ═══════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE : générer les picks du jour
// ═══════════════════════════════════════════════════════════════════

/**
 * Génère les pronos du jour en appelant Claude avec les matchs enrichis.
 *
 * @param matches Liste des matchs ESPN enrichis avec leurs cotes
 * @returns Résultat structuré + métriques de coût
 */
export async function generateAIPicks(
  matches: EnrichedMatch[],
): Promise<AIGenerationResult> {
  const startTime = Date.now();
  const apiKey = process.env.CLAUDE_API_KEY_AI_PICKS ?? "";

  // Métriques par défaut (pour les retours d'erreur)
  const emptyMetrics = {
    model: MODEL,
    tokensInput: 0,
    tokensOutput: 0,
    tokensTotal: 0,
    estimatedCostUsd: 0,
    durationMs: 0,
  };

  if (!apiKey) {
    return {
      success: false,
      errors: ["CLAUDE_API_KEY_AI_PICKS manquante dans l'env"],
      metrics: { ...emptyMetrics, durationMs: Date.now() - startTime },
    };
  }

  // Construction du prompt user avec les matchs
  const userPrompt = buildUserPrompt(matches);

  console.log(
    `[AI] Génération lancée: ${matches.length} matchs, modèle=${MODEL}`,
  );

  // Préparer la requête
  const requestBody = {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: AI_PICKS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  };

  // Appel API
  let response: Response;
  try {
    response = await fetchAnthropic(apiKey, requestBody);
  } catch (err) {
    return {
      success: false,
      errors: [`Erreur réseau Anthropic: ${String(err)}`],
      metrics: { ...emptyMetrics, durationMs: Date.now() - startTime },
    };
  }

  const durationMs = Date.now() - startTime;

  // Gestion des erreurs HTTP
  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errorBody = await response.text();
      errorDetail += `: ${errorBody.slice(0, 500)}`;
    } catch {
      // Ignore
    }
    console.error(`[AI] Échec appel Anthropic: ${errorDetail}`);
    return {
      success: false,
      errors: [errorDetail],
      metrics: { ...emptyMetrics, durationMs },
    };
  }

  // Parse de la réponse
  let anthropicResponse: AnthropicMessageResponse;
  try {
    anthropicResponse = (await response.json()) as AnthropicMessageResponse;
  } catch (err) {
    return {
      success: false,
      errors: [`Réponse Anthropic illisible: ${String(err)}`],
      metrics: { ...emptyMetrics, durationMs },
    };
  }

  // Extraction du texte (Claude renvoie un array de blocs content)
  const textBlock = anthropicResponse.content?.find((c) => c.type === "text");
  const rawText = textBlock?.text ?? "";

  if (!rawText) {
    return {
      success: false,
      errors: ["Aucun texte dans la réponse Anthropic"],
      metrics: {
        ...emptyMetrics,
        tokensInput: anthropicResponse.usage?.input_tokens ?? 0,
        tokensOutput: anthropicResponse.usage?.output_tokens ?? 0,
        durationMs,
      },
      rawResponse: JSON.stringify(anthropicResponse),
    };
  }

  // Métriques (toujours collectées même si parsing échoue)
  const tokensInput = anthropicResponse.usage?.input_tokens ?? 0;
  const tokensOutput = anthropicResponse.usage?.output_tokens ?? 0;
  const tokensTotal = tokensInput + tokensOutput;
  const estimatedCostUsd = computeCost(tokensInput, tokensOutput);

  const metrics = {
    model: MODEL,
    tokensInput,
    tokensOutput,
    tokensTotal,
    estimatedCostUsd,
    durationMs,
  };

  console.log(
    `[AI] Réponse reçue en ${durationMs}ms — tokens: ${tokensInput} in + ${tokensOutput} out = ${tokensTotal} (~$${estimatedCostUsd.toFixed(4)})`,
  );

  // Validation Zod de la réponse
  const parseResult = parseAIResponse(rawText);

  if (!parseResult.success) {
    console.error(
      `[AI] Échec validation Zod:`,
      parseResult.errors,
    );
    return {
      success: false,
      errors: parseResult.errors,
      metrics,
      rawResponse: rawText,
    };
  }

  const data = parseResult.data!;
  console.log(
    `[AI] Validation OK — ${data.classics.length} classiques + ${data.scorers.length} buteurs`,
  );

  return {
    success: true,
    data,
    metrics,
    rawResponse: rawText,
  };
}