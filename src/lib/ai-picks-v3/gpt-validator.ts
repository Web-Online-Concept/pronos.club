/**
 * PRONOS.CLUB — GPT Validator (v3)
 *
 * Rôle : avocat du diable INDULGENT pour les picks Claude tipster.
 *
 * Philosophie :
 *   - GPT-4o ne refait PAS l'analyse. Il vérifie juste qu'il n'y a pas
 *     d'erreur grossière dans le pick proposé par Claude.
 *   - Décision par défaut : "approve". Le veto doit être rare.
 *   - 3 verdicts possibles : approve | warning | veto.
 *
 * Cas concrets de veto :
 *   - Stat citée comme argument N'EXISTE PAS dans la data fournie
 *   - Argument cite une surface différente du tournoi (Hard pour Clay)
 *   - Pick contre l'évidence (favori clair avec 4+ indicateurs en sa faveur, on a pris l'outsider)
 *   - Cote citée ne correspond à aucun book réel
 *
 * Cas de warning (pas de veto) :
 *   - Pick à confiance 65 sur cote 1.55 (limite mais pas grave)
 *   - 2 arguments mais l'un est faible
 *   - Choix de marché surprenant mais défendable
 *
 * Cas d'approve (par défaut) :
 *   - Tout pick avec arguments cohérents tirés de la data, même si on aurait
 *     personnellement préféré l'autre côté du marché
 *
 * Coût estimé : ~0,01-0,02$ / appel (max 7 picks à valider).
 */

import OpenAI from "openai";
import type {
  FetchOutput,
  TipsterPick,
  ValidatorResult,
  ValidatorVerdict,
} from "./tipster-types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

const GPT_MODEL = process.env.GPT_VALIDATOR_MODEL ?? "gpt-4o";

const MAX_TOKENS = 2000;

// Tarifs GPT-4o (USD / 1M tokens) — à mettre à jour si OpenAI révise
const PRICING_INPUT_PER_MTOK = 2.5;
const PRICING_OUTPUT_PER_MTOK = 10.0;

// ============================================================================
// CLIENT OPENAI (lazy init)
// ============================================================================

let _openaiClient: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!_openaiClient) {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable not set");
    }
    _openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return _openaiClient;
};

// ============================================================================
// PROMPTS
// ============================================================================

const VALIDATOR_SYSTEM_PROMPT = `Tu es un validator INDULGENT pour des pronostics sportifs générés par un autre IA tipster.

Ton rôle : vérifier qu'il n'y a PAS d'erreur grossière, mais accepter par défaut.

Tu reçois :
1. La DATA brute du jour (matchs avec stats : forme, H2H, blessures, ranking, surface, etc.)
2. Une LISTE DE PICKS proposés par le tipster Claude

Pour chaque pick, tu dois rendre un verdict parmi 3 :

- **"approve"** (par défaut) : Le pick est cohérent. Les arguments cités sont vérifiables dans la data ou raisonnables.

- **"warning"** : Le pick a une faiblesse (argument moyen, choix surprenant) mais reste défendable. Le pick est conservé, juste flagué.

- **"veto"** : Le pick a un problème GRAVE et doit être retiré. Réservé aux cas suivants :
   * Stat citée comme argument qui N'EXISTE PAS dans la data fournie (hallucination)
   * Argument cite la mauvaise surface en tennis (ex: H2H Hard pour justifier un pick Clay)
   * Pick contre l'évidence absolue (favori avec 4+ indicateurs forts en sa faveur, le tipster a pris l'outsider sans justification solide)
   * Cote citée incohérente avec ce que la data fournit pour ce match

PHILOSOPHIE : Tu n'es PAS un second tipster. Tu n'as PAS à dire "j'aurais préféré l'autre côté".
Tu vérifies uniquement la **rigueur factuelle** et l'**absence d'erreur grossière**.
Si le pick est défendable même si tu n'es pas 100% d'accord, tu APPROUVES.

OUTPUT FORMAT (JSON strict, RIEN d'autre) :

\`\`\`json
{
  "verdicts": [
    {
      "pick_id": 1,
      "decision": "approve" | "warning" | "veto",
      "reason": "string courte (1-2 phrases) en français"
    }
  ]
}
\`\`\`

Règles :
- 1 verdict par pick (même nombre de verdicts que de picks)
- pick_id doit correspondre à l'id du pick analysé
- reason en français, factuelle, sans hype
- Si decision = "approve", reason peut être courte ("Arguments cohérents avec la data.")
- Si decision = "warning" ou "veto", reason DOIT pointer le problème précis`;

const buildValidatorUserPrompt = (
  fetchOutput: FetchOutput,
  picks: TipsterPick[]
): string => {
  return `# DATE
${fetchOutput.date_du_jour}

# DATA DU JOUR (extraite, fixtures concernées par les picks uniquement)

\`\`\`json
${JSON.stringify(extractRelevantFixtures(fetchOutput, picks), null, 2)}
\`\`\`

# PICKS À VALIDER

\`\`\`json
${JSON.stringify(picks, null, 2)}
\`\`\`

# TÂCHE

Pour CHAQUE pick ci-dessus, rends un verdict (approve / warning / veto) en JSON selon le format défini dans le system prompt.

Rappel : sois INDULGENT. Veto seulement si erreur factuelle grave.`;
};

/**
 * Extrait UNIQUEMENT les fixtures concernées par les picks (au lieu d'envoyer
 * toute la data du jour qui peut faire 200KB). Ça réduit le coût GPT.
 */
const extractRelevantFixtures = (
  fetchOutput: FetchOutput,
  picks: TipsterPick[]
): { date_du_jour: string; matchs: typeof fetchOutput.matchs } => {
  // Liste des "match" (string) concernés par les picks
  const matchNames = new Set<string>();
  for (const pick of picks) {
    if (pick.type === "simple") {
      matchNames.add(pick.match);
    } else if (pick.type === "combine") {
      for (const sel of pick.selections) {
        matchNames.add(sel.match);
      }
    }
  }

  const relevantMatchs = fetchOutput.matchs.filter((m) =>
    matchNames.has(m.match)
  );

  return {
    date_du_jour: fetchOutput.date_du_jour,
    matchs: relevantMatchs,
  };
};

// ============================================================================
// PARSING DU JSON OUTPUT
// ============================================================================

const extractValidatorJson = (text: string): { verdicts: ValidatorVerdict[] } => {
  // Tentative 1 : bloc ```json...```
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  let jsonStr: string | null = null;

  if (jsonBlockMatch && jsonBlockMatch[1]) {
    jsonStr = jsonBlockMatch[1].trim();
  } else {
    // Tentative 2 : objet JSON brut dans le texte
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = text.substring(firstBrace, lastBrace + 1);
    }
  }

  if (!jsonStr) {
    throw new Error("Aucun JSON output dans la réponse GPT validator");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(
      `JSON parsing failed (validator): ${(err as Error).message}`
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("verdicts" in parsed)
  ) {
    throw new Error("JSON validator invalide : champ verdicts manquant");
  }

  const obj = parsed as { verdicts: unknown };
  if (!Array.isArray(obj.verdicts)) {
    throw new Error("verdicts n'est pas un array");
  }

  // Validation des verdicts
  const validVerdicts: ValidatorVerdict[] = [];
  for (const v of obj.verdicts) {
    if (
      typeof v !== "object" ||
      v === null ||
      typeof (v as { pick_id: unknown }).pick_id !== "number" ||
      !["approve", "warning", "veto"].includes(
        (v as { decision: unknown }).decision as string
      ) ||
      typeof (v as { reason: unknown }).reason !== "string"
    ) {
      console.warn(
        `[gpt-validator] Verdict mal formé ignoré : ${JSON.stringify(v)}`
      );
      continue;
    }
    validVerdicts.push(v as ValidatorVerdict);
  }

  return { verdicts: validVerdicts };
};

// ============================================================================
// CALCUL DU COÛT
// ============================================================================

const computeCostUsd = (
  tokensInput: number,
  tokensOutput: number
): number => {
  const inputCost = (tokensInput * PRICING_INPUT_PER_MTOK) / 1_000_000;
  const outputCost = (tokensOutput * PRICING_OUTPUT_PER_MTOK) / 1_000_000;
  return parseFloat((inputCost + outputCost).toFixed(6));
};

// ============================================================================
// FALLBACK : auto-approve tous les picks si le validator foire
// ============================================================================

/**
 * Si le validator GPT échoue (API down, parsing impossible, etc.), on n'arrête
 * PAS la pipeline : on auto-approuve tous les picks Claude par défaut.
 *
 * Logique métier : Claude tipster est déjà rigoureux (prompt v2.2 strict).
 * Le validator est une couche de sécurité bonus — si elle plante, mieux vaut
 * publier les picks Claude que de tout bloquer.
 */
const autoApproveAll = (picks: TipsterPick[]): ValidatorVerdict[] => {
  return picks.map((pick) => ({
    pick_id: pick.id,
    decision: "approve" as const,
    reason: "Auto-approved (validator GPT indisponible).",
  }));
};

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Valide une liste de picks Claude tipster avec GPT-4o.
 *
 * Stratégie de robustesse :
 *   - Si l'appel GPT échoue → auto-approve tous les picks (fallback)
 *   - Si parsing JSON échoue → auto-approve tous les picks (fallback)
 *   - Si le nombre de verdicts ≠ nombre de picks → auto-approve les picks manquants
 *
 * Cette robustesse est volontaire : on préfère publier 7 picks Claude que de
 * tout bloquer parce que GPT a hoqueté.
 */
export const runGptValidator = async (
  fetchOutput: FetchOutput,
  picks: TipsterPick[]
): Promise<ValidatorResult> => {
  const startedAt = Date.now();

  // Cas trivial : pas de picks à valider
  if (picks.length === 0) {
    return {
      verdicts: [],
      meta: {
        model: GPT_MODEL,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        duration_ms: Date.now() - startedAt,
      },
    };
  }

  let client: OpenAI;
  try {
    client = getOpenAIClient();
  } catch (err) {
    console.warn(
      `[gpt-validator] OpenAI client init failed, auto-approve fallback : ${(err as Error).message}`
    );
    return {
      verdicts: autoApproveAll(picks),
      meta: {
        model: GPT_MODEL,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        duration_ms: Date.now() - startedAt,
      },
      error: (err as Error).message,
    };
  }

  const userPrompt = buildValidatorUserPrompt(fetchOutput, picks);

  let response: OpenAI.Chat.Completions.ChatCompletion;
  try {
    response = await client.chat.completions.create({
      model: GPT_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: VALIDATOR_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
  } catch (err) {
    console.warn(
      `[gpt-validator] OpenAI API call failed, auto-approve fallback : ${(err as Error).message}`
    );
    return {
      verdicts: autoApproveAll(picks),
      meta: {
        model: GPT_MODEL,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        duration_ms: Date.now() - startedAt,
      },
      error: (err as Error).message,
    };
  }

  // Extraction de la réponse
  const responseText = response.choices[0]?.message?.content ?? "";
  const tokensInput = response.usage?.prompt_tokens ?? 0;
  const tokensOutput = response.usage?.completion_tokens ?? 0;
  const costUsd = computeCostUsd(tokensInput, tokensOutput);

  // Parsing du JSON
  let verdicts: ValidatorVerdict[];
  try {
    const parsed = extractValidatorJson(responseText);
    verdicts = parsed.verdicts;
  } catch (err) {
    console.warn(
      `[gpt-validator] JSON parsing failed, auto-approve fallback : ${(err as Error).message}`
    );
    return {
      verdicts: autoApproveAll(picks),
      meta: {
        model: GPT_MODEL,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_usd: costUsd,
        duration_ms: Date.now() - startedAt,
      },
      error: (err as Error).message,
    };
  }

  // Sanity check : compléter les verdicts manquants par auto-approve
  const verdictMap = new Map(verdicts.map((v) => [v.pick_id, v]));
  const completed: ValidatorVerdict[] = [];
  for (const pick of picks) {
    const v = verdictMap.get(pick.id);
    if (v) {
      completed.push(v);
    } else {
      console.warn(
        `[gpt-validator] Verdict manquant pour pick #${pick.id}, auto-approve`
      );
      completed.push({
        pick_id: pick.id,
        decision: "approve",
        reason: "Auto-approved (verdict GPT manquant).",
      });
    }
  }

  return {
    verdicts: completed,
    meta: {
      model: GPT_MODEL,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      cost_usd: costUsd,
      duration_ms: Date.now() - startedAt,
    },
  };
};