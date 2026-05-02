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
 * FIX A3 + C1 (session 02/05/2026) :
 *   - VALIDATOR_SYSTEM_PROMPT enrichi avec les règles métier tipster
 *   - GPT doit maintenant vetoer les violations techniques (cotes, écarts)
 *   - Auparavant GPT ne vérifiait que la cohérence factuelle → laissait passer des cotes < 1.50
 *
 * Cas de veto (mise à jour) :
 *   VIOLATIONS TECHNIQUES (nouvelles — priorité absolue) :
 *     - Cote simple < 1.50 ou > 3.50 (règle publique PRONOS.CLUB)
 *     - Cote par sélection combiné < 1.30
 *     - Cote totale combiné < 1.50 ou > 4.00
 *     - Écart > 30% entre cote_arjel et cote_hors_arjel (hallucination)
 *   VIOLATIONS FACTUELLES (existantes) :
 *     - Stat citée qui N'EXISTE PAS dans la data fournie
 *     - Argument cite la mauvaise surface en tennis
 *     - Pick contre l'évidence absolue (favori 4+ indicateurs, outsider pris sans justification)
 *     - Cote citée incohérente avec ce que la data fournit
 *
 * Coût estimé : ~0,01-0,02$ / appel (max 10 picks à valider).
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

/**
 * FIX C1 — VALIDATOR_SYSTEM_PROMPT enrichi avec les règles métier tipster.
 *
 * Avant ce fix, GPT ne connaissait que les règles factuelles et laissait passer
 * des picks avec cote 1.08, 1.20, 1.23 — en violation des règles publiques du service.
 *
 * Maintenant GPT vérifie EN PREMIER les règles techniques (cotes min/max, écarts),
 * et veto immédiatement sans avoir besoin d'analyser la data pour ces cas.
 */
const VALIDATOR_SYSTEM_PROMPT = `Tu es un validator INDULGENT pour des pronostics sportifs générés par un autre IA tipster.

Ton rôle : vérifier qu'il n'y a PAS d'erreur grossière, mais accepter par défaut.

Tu reçois :
1. La DATA brute du jour (matchs avec stats : forme, H2H, blessures, ranking, surface, etc.)
2. Une LISTE DE PICKS proposés par le tipster Claude

Pour chaque pick, tu dois rendre un verdict parmi 3 :

- **"approve"** (par défaut) : Le pick est cohérent. Les arguments cités sont vérifiables dans la data ou raisonnables.

- **"warning"** : Le pick a une faiblesse (argument moyen, choix surprenant) mais reste défendable. Le pick est conservé, juste flagué.

- **"veto"** : Le pick a un problème GRAVE et doit être retiré.

═══════════════════════════════════════════════════
RÈGLES DE VETO — PRIORITÉ ABSOLUE
═══════════════════════════════════════════════════

**CATÉGORIE A — VIOLATIONS TECHNIQUES (veto automatique, aucune discussion)** :

Ces règles sont des contraintes PUBLIQUES de PRONOS.CLUB. Un pick qui les viole est directement invalidé, quelle que soit la qualité de l'analyse.

1. **Cote simple < 1.50** : Si la meilleure cote disponible (max de cote_arjel et cote_hors_arjel) est inférieure à 1.50 → VETO immédiat.
   Exemples de cotes INTERDITES : 1.08, 1.20, 1.23, 1.35, 1.48, 1.49
   Exemple de reason : "Veto technique : cote 1.23 < minimum absolu 1.50."

2. **Cote simple > 3.50** : Si la meilleure cote dépasse 3.50 → VETO immédiat.
   Exemple de reason : "Veto technique : cote 3.75 > maximum 3.50."

3. **Cote par sélection d'un combiné < 1.30** : Si une sélection d'un combiné a une cote inférieure à 1.30 → VETO du combiné entier.
   Exemple : sélection à 1.20 dans un combiné → VETO.
   Exemple de reason : "Veto technique : sélection [match] à cote 1.20 < minimum 1.30 par sélection."

4. **Cote totale d'un combiné hors [1.50 – 4.00]** : Si la meilleure cote totale (max de cote_totale_arjel et cote_totale_hors_arjel) est < 1.50 ou > 4.00 → VETO.

5. **Écart ARJEL/hors_ARJEL > 30%** : Si l'écart entre cote_arjel et cote_hors_arjel (ou cote_totale_arjel et cote_totale_hors_arjel) dépasse 30%, c'est un signe de confusion de marché ou d'hallucination → VETO.
   Formule : (max - min) / min > 0.30
   Exemple : cote_arjel=1.14, cote_hors_arjel=2.36 → écart de 107% → VETO.
   Exemple : cote_arjel=1.85, cote_hors_arjel=2.10 → écart de 13.5% → OK.
   Exemple de reason : "Veto technique : écart ARJEL/hors_ARJEL de 107% (1.14 vs 2.36), hallucination probable."

**CATÉGORIE B — VIOLATIONS FACTUELLES (veto si erreur grave)** :

6. **Stat hallucinée** : Un argument cite une stat qui N'EXISTE PAS dans la data fournie (ex : "Joueur A a 78% first serve" alors que la data ne mentionne aucun %).

7. **Surface incohérente en tennis** : Un argument tire une conclusion d'un H2H sur Hard pour justifier un pick sur Clay (ou inversement). La surface de l'argument DOIT correspondre à la surface du tournoi du jour.

8. **Pick contre l'évidence absolue** : Un favori clair (4+ indicateurs forts en sa faveur : ranking, forme, surface YTD, H2H) est ignoré au profit de l'outsider sans justification solide dans l'analyse.

9. **Cote inventée** : La cote citée ne correspond à aucune des cotes présentes dans la data pour ce match.

═══════════════════════════════════════════════════

PHILOSOPHIE : Tu n'es PAS un second tipster. Tu n'as PAS à dire "j'aurais préféré l'autre côté".

Pour la Catégorie A : vérifie les champs JSON du pick directement (pas besoin de la data).
Pour la Catégorie B : compare les arguments du pick à la data fournie.

Si le pick est défendable même si tu n'es pas 100% d'accord → APPROUVES.
Si le pick a une petite faiblesse mais reste défendable → WARNING.
Si le pick viole une règle de la Catégorie A ou B → VETO avec reason précise.

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

Règles de format :
- 1 verdict par pick (même nombre de verdicts que de picks)
- pick_id doit correspondre à l'id du pick analysé
- reason en français, factuelle, sans hype
- Si decision = "approve", reason peut être courte ("Arguments cohérents avec la data.")
- Si decision = "warning" ou "veto", reason DOIT pointer le problème précis (catégorie + détail chiffré si possible)`;

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

Commence par vérifier les règles de Catégorie A (violations techniques — directement dans les champs JSON du pick), puis les règles de Catégorie B (violations factuelles — en comparant les arguments à la data).

Rappel :
- VETO immédiat si cote simple < 1.50 ou > 3.50
- VETO immédiat si sélection combiné < 1.30
- VETO immédiat si écart ARJEL/hors_ARJEL > 30%
- Pour le reste : sois INDULGENT. Veto seulement si erreur factuelle grave.`;
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
 * Logique métier : claude-tipster.ts filtre déjà les violations techniques
 * (cotes min/max, écarts ARJEL/hors_ARJEL) AVANT d'envoyer à GPT.
 * Donc si GPT est down, les picks reçus par le fallback sont déjà propres.
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
 * Note : les picks reçus par cette fonction ont déjà passé validateAndFixPicks()
 * dans claude-tipster.ts. Les violations techniques (cotes) ont déjà été filtrées.
 * GPT intervient ici comme 2e couche (factuelle + technique en double-check).
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