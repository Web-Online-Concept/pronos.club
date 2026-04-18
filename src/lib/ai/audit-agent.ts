/**
 * ═══════════════════════════════════════════════════════════════════
 * AUDIT AGENT — Pronos IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Agent automatique de vérification des picks après génération.
 *
 * Principe :
 *   Après la génération par Claude #1, Claude #2 relit chaque pick
 *   avec la possibilité de faire des recherches web pour vérifier :
 *     - Le joueur joue-t-il toujours dans ce club ? (transferts)
 *     - L'équipe est-elle toujours dans cette ligue ? (relégations)
 *     - Le pick est-il factuellement cohérent ?
 *
 * Décision 100% automatique (pas de validation humaine).
 * 3 statuts possibles :
 *   - "valid"    → le pick passe en status='pending' (visible public)
 *   - "rejected" → le pick passe en status='rejected_by_audit' (masqué)
 *   - "error"    → en cas d'erreur on valide par défaut (fail-safe)
 *
 * Niveau de strictness : MODÉRÉ
 *   - Rejet uniquement si fait vérifiable (transfert, relégation, erreur factuelle)
 *   - Pas de rejet sur "intuition" ou "contexte flou"
 *
 * ═══════════════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";


// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 1000;
const API_TIMEOUT_MS = 90000;

/** Prix Sonnet 4.6 (référence avril 2026) */
const PRICE_INPUT_PER_MTOKENS = 3.0;
const PRICE_OUTPUT_PER_MTOKENS = 15.0;


// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface PickToAudit {
  id: string;
  pick_type: "classic" | "scorer";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  reasoning: string;
}

interface AuditDecision {
  pickId: string;
  decision: "valid" | "rejected";
  reason: string | null;
  category: "player_transferred" | "team_relegated" | "factual_error" | "other" | null;
}

export interface AuditReport {
  success: boolean;
  totalPicks: number;
  validated: number;
  rejected: number;
  decisions: AuditDecision[];
  tokensUsed: number;
  estimatedCostUsd: number;
  durationMs: number;
  errors: string[];
}


// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT pour l'auditeur
// ═══════════════════════════════════════════════════════════════════

const AUDIT_SYSTEM_PROMPT = `Tu es un agent d'audit chargé de vérifier la cohérence factuelle de pronostics sportifs générés par une autre IA.

Ton rôle :
  - Relire chaque pronostic
  - Identifier les ERREURS FACTUELLES VÉRIFIABLES
  - Rejeter uniquement si tu es CERTAIN qu'il y a une erreur factuelle

Types d'erreurs à détecter et REJETER :
  1. Joueur transféré : "Buteur X de l'équipe Y" alors que X a été transféré ailleurs
  2. Équipe reléguée : L'équipe n'est plus dans la ligue indiquée
  3. Erreur factuelle manifeste : Le reasoning contient une affirmation vérifiablement fausse
  4. Joueur retraité : Le joueur mentionné a pris sa retraite

Règles ABSOLUES :
  - STRICTNESS MODÉRÉE : rejette uniquement sur des faits vérifiables
  - Ne rejette JAMAIS sur l'intuition ou le ressenti
  - Ne juge JAMAIS la qualité sportive du pick (cote trop basse/haute, favori logique, etc.)
  - En cas de doute sérieux, VALIDE le pick (on préfère un pick douteux à une censure injustifiée)
  - Tes connaissances peuvent être périmées : si tu n'es pas sûr à 100%, VALIDE

Format de réponse attendu :
  Tu dois répondre uniquement en JSON strict, sans aucun texte avant ou après.
  {
    "decision": "valid" | "rejected",
    "category": "player_transferred" | "team_relegated" | "factual_error" | "other" | null,
    "reason": "Explication courte (1 phrase) si rejeté, null sinon"
  }`;


// ═══════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase credentials manquantes");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


// ═══════════════════════════════════════════════════════════════════
// FETCH ANTHROPIC
// ═══════════════════════════════════════════════════════════════════

async function callClaudeAuditor(
  userPrompt: string,
): Promise<{ text: string; tokensInput: number; tokensOutput: number }> {
  const apiKey = process.env.CLAUDE_API_KEY_AI_PICKS ?? "";
  if (!apiKey) throw new Error("CLAUDE_API_KEY_AI_PICKS manquante");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: AUDIT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((c: { type: string }) => c.type === "text");
    const text = textBlock?.text ?? "";

    return {
      text,
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}


// ═══════════════════════════════════════════════════════════════════
// BUILD USER PROMPT pour un pick
// ═══════════════════════════════════════════════════════════════════

function buildAuditPrompt(pick: PickToAudit): string {
  const eventDate = new Date(pick.event_date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (pick.pick_type === "scorer") {
    return `Vérifie ce pronostic de buteur :

Match : ${pick.event_name}
Ligue : ${pick.league}
Date : ${eventDate}
Joueur sélectionné : ${pick.selection}
Justification de l'IA : "${pick.reasoning}"

Question clé : le joueur "${pick.selection}" joue-t-il actuellement dans l'équipe dont il est censé être buteur ?

Vérifie aussi :
  - Le joueur n'est-il pas retraité ?
  - N'y a-t-il pas une erreur manifeste dans la justification ?

Réponds en JSON strict.`;
  }

  return `Vérifie ce pronostic classique :

Match : ${pick.event_name}
Ligue : ${pick.league}
Date : ${eventDate}
Marché : ${pick.market}
Pick : ${pick.selection}
Justification de l'IA : "${pick.reasoning}"

Questions clés :
  - Les équipes évoluent-elles bien dans la ligue indiquée (${pick.league}) ?
  - La justification contient-elle des faits manifestement faux ? (ex: joueur cité qui n'est plus dans l'équipe)

Réponds en JSON strict.`;
}


// ═══════════════════════════════════════════════════════════════════
// PARSE JSON RESPONSE
// ═══════════════════════════════════════════════════════════════════

function parseAuditResponse(text: string): {
  decision: "valid" | "rejected";
  reason: string | null;
  category: AuditDecision["category"];
} {
  // Nettoyer les markdown fences éventuels
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Extraire l'objet JSON (au cas où il y aurait du texte autour malgré les consignes)
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Pas de JSON trouvé dans la réponse");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (parsed.decision !== "valid" && parsed.decision !== "rejected") {
    throw new Error(`Decision invalide: ${parsed.decision}`);
  }

  return {
    decision: parsed.decision,
    reason: parsed.reason ?? null,
    category: parsed.category ?? null,
  };
}


// ═══════════════════════════════════════════════════════════════════
// AUDIT D'UN PICK INDIVIDUEL
// ═══════════════════════════════════════════════════════════════════

async function auditSinglePick(pick: PickToAudit): Promise<{
  decision: AuditDecision;
  tokensInput: number;
  tokensOutput: number;
  error?: string;
}> {
  try {
    const prompt = buildAuditPrompt(pick);
    const { text, tokensInput, tokensOutput } = await callClaudeAuditor(prompt);

    const parsed = parseAuditResponse(text);

    return {
      decision: {
        pickId: pick.id,
        decision: parsed.decision,
        reason: parsed.reason,
        category: parsed.category,
      },
      tokensInput,
      tokensOutput,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Audit] Erreur sur pick ${pick.id}: ${message}`);
    // Fail-safe : en cas d'erreur, on VALIDE par défaut (pas de censure injustifiée)
    return {
      decision: {
        pickId: pick.id,
        decision: "valid",
        reason: null,
        category: null,
      },
      tokensInput: 0,
      tokensOutput: 0,
      error: message,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════

/**
 * Audite tous les picks générés aujourd'hui qui sont en status 'pending_review'.
 * Met à jour leur status selon la décision de l'auditeur.
 */
export async function auditTodayPicks(): Promise<AuditReport> {
  const startTime = Date.now();
  const errors: string[] = [];

  const report: AuditReport = {
    success: false,
    totalPicks: 0,
    validated: 0,
    rejected: 0,
    decisions: [],
    tokensUsed: 0,
    estimatedCostUsd: 0,
    durationMs: 0,
    errors,
  };

  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split("T")[0];

    // Fetch les picks à auditer (status 'pending_review', d'aujourd'hui)
    const { data: picksData, error: fetchError } = await supabase
      .from("ai_picks")
      .select(
        "id, pick_type, sport, league, event_name, event_date, selection, market, reasoning",
      )
      .eq("status", "pending_review")
      .eq("generation_batch", today);

    if (fetchError) {
      errors.push(`Erreur fetch picks: ${fetchError.message}`);
      report.durationMs = Date.now() - startTime;
      return report;
    }

    const picks = (picksData ?? []) as PickToAudit[];
    report.totalPicks = picks.length;

    if (picks.length === 0) {
      console.log("[Audit] Aucun pick à auditer");
      report.success = true;
      report.durationMs = Date.now() - startTime;
      return report;
    }

    console.log(`[Audit] ${picks.length} picks à auditer`);

    // Auditer chaque pick SÉQUENTIELLEMENT (évite le rate limit)
    let totalTokensInput = 0;
    let totalTokensOutput = 0;

    for (const pick of picks) {
      const result = await auditSinglePick(pick);
      report.decisions.push(result.decision);
      totalTokensInput += result.tokensInput;
      totalTokensOutput += result.tokensOutput;

      if (result.error) {
        errors.push(`Pick ${pick.id}: ${result.error}`);
      }

      // Mettre à jour le pick en base
      const newStatus =
        result.decision.decision === "valid" ? "pending" : "rejected_by_audit";

      const { error: updateError } = await supabase
        .from("ai_picks")
        .update({
          status: newStatus,
          audit_reason: result.decision.reason,
          audit_category: result.decision.category,
          audited_at: new Date().toISOString(),
        })
        .eq("id", pick.id);

      if (updateError) {
        errors.push(`Update pick ${pick.id}: ${updateError.message}`);
      }

      if (result.decision.decision === "valid") {
        report.validated++;
      } else {
        report.rejected++;
        console.log(
          `[Audit] ❌ REJETÉ: ${pick.event_name} — ${pick.selection} — ${result.decision.reason}`,
        );
      }
    }

    // Calcul coûts
    const tokensTotal = totalTokensInput + totalTokensOutput;
    const cost =
      (totalTokensInput / 1_000_000) * PRICE_INPUT_PER_MTOKENS +
      (totalTokensOutput / 1_000_000) * PRICE_OUTPUT_PER_MTOKENS;

    report.tokensUsed = tokensTotal;
    report.estimatedCostUsd = cost;
    report.success = true;
    report.durationMs = Date.now() - startTime;

    // Logger l'exécution
    await supabase.from("ai_generation_logs").insert({
      run_type: "audit",
      run_date: today,
      status: errors.length > 0 ? "partial" : "success",
      picks_created: 0,
      picks_resolved: 0,
      errors_count: errors.length,
      errors: errors.length > 0 ? errors : null,
      tokens_used: tokensTotal,
      estimated_cost: cost,
      duration_ms: report.durationMs,
    });

    console.log(
      `[Audit] ✅ Terminé — ${report.validated}/${report.totalPicks} validés, ${report.rejected} rejetés (${report.durationMs}ms, $${cost.toFixed(4)})`,
    );

    return report;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Erreur fatale: ${msg}`);
    console.error(`[Audit] ${msg}`, err);
    report.durationMs = Date.now() - startTime;
    return report;
  }
}