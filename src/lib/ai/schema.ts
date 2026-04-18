/**
 * ═══════════════════════════════════════════════════════════════════
 * SCHEMAS ZOD — Validation de la réponse IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Ces schemas valident la sortie JSON de Claude avant insertion en BDD.
 * Si Claude retourne un JSON non conforme, l'appel échoue proprement
 * plutôt que de corrompre la base.
 * ═══════════════════════════════════════════════════════════════════
 */

import { z } from "zod";


// ═══════════════════════════════════════════════════════════════════
// PICK CLASSIQUE (1N2 / Over-Under / BTTS / vainqueur)
// ═══════════════════════════════════════════════════════════════════

export const ClassicPickSchema = z.object({
  // Identification du match
  event_name: z.string().min(3, "event_name trop court"),
  sport: z.enum(["soccer", "tennis", "basketball"]),
  league: z.string().min(3),
  event_date: z.iso.datetime({
    error: "event_date doit être au format ISO 8601 UTC",
  }),
  espn_event_id: z.string().nullable(),

  // Le pick
  market: z.enum(["h2h", "ou25", "btts", "totals"], {
    error: "market doit être h2h, ou25, btts ou totals",
  }),
  selection: z.string().min(1).max(100),
  odds: z
    .number()
    .min(1.5, "cote min 1.50 (règle absolue)")
    .max(3.0, "cote max 3.00 (règle absolue)"),

  // Bookmaker source de la cote (optionnel, ajouté par le backend)
  odds_bookmaker: z.string().optional(),

  // Justification
  reasoning: z
    .string()
    .min(10, "reasoning trop court")
    .max(120, "reasoning trop long (max 120 chars)"),
  confidence: z.number().int().min(1).max(10),
});

export type ClassicPick = z.infer<typeof ClassicPickSchema>;


// ═══════════════════════════════════════════════════════════════════
// PICK BUTEUR (foot uniquement, pas de cote)
// ═══════════════════════════════════════════════════════════════════

export const ScorerPickSchema = z.object({
  // Identification du match
  event_name: z.string().min(3),
  league: z.string().min(3),
  event_date: z.iso.datetime(),
  espn_event_id: z.string().nullable(),

  // Le pick
  player_name: z
    .string()
    .min(2, "player_name trop court")
    .max(80, "player_name trop long"),

  // Justification
  reasoning: z.string().min(10).max(120),
  confidence: z.number().int().min(1).max(10),
});

export type ScorerPick = z.infer<typeof ScorerPickSchema>;


// ═══════════════════════════════════════════════════════════════════
// RÉPONSE COMPLÈTE DE L'IA
// ═══════════════════════════════════════════════════════════════════

export const AIResponseSchema = z.object({
  classics: z
    .array(ClassicPickSchema)
    .max(5, "Max 5 pronos classiques par jour"),
  scorers: z
    .array(ScorerPickSchema)
    .max(3, "Max 3 pronos buteurs par jour"),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;


// ═══════════════════════════════════════════════════════════════════
// HELPER : Parse défensif de la réponse IA
// ═══════════════════════════════════════════════════════════════════

export interface ParseResult {
  success: boolean;
  data?: AIResponse;
  errors?: string[];
}

/**
 * Parse la réponse texte de Claude en JSON validé.
 *
 * Gère :
 *  - Les JSON entourés de markdown (```json ... ```)
 *  - Les JSON avec texte avant/après
 *  - Les erreurs de validation Zod (message clair)
 */
export function parseAIResponse(rawText: string): ParseResult {
  // 1. Nettoyer : retirer les fences markdown s'il y en a
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // 2. Isoler l'objet JSON s'il y a du texte avant/après
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    return {
      success: false,
      errors: ["Aucun JSON trouvé dans la réponse IA"],
    };
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  // 3. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      success: false,
      errors: [`JSON invalide: ${String(err)}`],
    };
  }

  // 4. Valider avec Zod
  const result = AIResponseSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    );
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}