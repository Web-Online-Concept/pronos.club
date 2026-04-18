/**
 * ═══════════════════════════════════════════════════════════════════
 * AUDIT AGENT v2 — Pronos IA avec WEB SEARCH
 * ═══════════════════════════════════════════════════════════════════
 *
 * Agent automatique de vérification des picks après génération.
 * Utilise le tool web_search d'Anthropic pour vérifier les faits
 * en temps réel (transferts, relégations, etc.).
 *
 * 3 statuts possibles après audit :
 *   - "valid"    → status='pending' (visible public)
 *   - "rejected" → status='rejected_by_audit' (masqué)
 *   - "error"    → en cas d'erreur on valide par défaut (fail-safe)
 *
 * Coût : ~0.10$/jour (web_search = $10/1000 recherches)
 * ═══════════════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";


// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 2000;
const API_TIMEOUT_MS = 120000; // 2 min (web search peut prendre du temps)

/** Limite le nombre de recherches web par pick (coût + temps) */
const MAX_WEB_SEARCHES_PER_PICK = 3;

/** Prix Sonnet 4.6 + web search */
const PRICE_INPUT_PER_MTOKENS = 3.0;
const PRICE_OUTPUT_PER_MTOKENS = 15.0;
const PRICE_WEB_SEARCH_PER_1000 = 10.0; // $10 pour 1000 recherches


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
  webSearches: number;
}

export interface AuditReport {
  success: boolean;
  totalPicks: number;
  validated: number;
  rejected: number;
  decisions: AuditDecision[];
  tokensUsed: number;
  webSearchesTotal: number;
  estimatedCostUsd: number;
  durationMs: number;
  errors: string[];
}


// ═══════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════

const AUDIT_SYSTEM_PROMPT = `Tu es un agent d'audit chargé de vérifier la cohérence factuelle de pronostics sportifs.

Tu as accès à l'outil web_search pour vérifier les faits en temps réel.

Ton rôle :
  - Vérifier les faits mentionnés dans le pronostic (joueurs, équipes, ligues)
  - Utiliser web_search EN PRIORITÉ pour les faits vérifiables
  - Rejeter uniquement si tu es CERTAIN qu'il y a une erreur factuelle avérée

Types d'erreurs à détecter et REJETER :
  1. Joueur transféré dans un autre club
  2. Équipe qui n'évolue plus dans la ligue indiquée
  3. Joueur retraité
  4. Affirmation manifestement fausse dans la justification

Règles ABSOLUES :
  - Utilise web_search quand tu as un doute (c'est gratuit pour toi)
  - Vérifie TOUJOURS pour les pronos buteurs (les transferts sont fréquents)
  - STRICTNESS MODÉRÉE : rejette seulement sur des faits VÉRIFIÉS par web_search
  - En cas de doute persistant après recherche, VALIDE (on préfère un doute à une censure injustifiée)
  - Ne juge JAMAIS la qualité sportive du pick (cote, favori logique, etc.)

Format de réponse FINAL attendu :
  Après tes recherches, ton dernier message doit être UNIQUEMENT ce JSON strict :
  {
    "decision": "valid" | "rejected",
    "category": "player_transferred" | "team_relegated" | "factual_error" | "other" | null,
    "reason": "Explication courte avec source si rejeté, null sinon"
  }

  Pas de texte avant ou après le JSON. Pas de markdown fences.`;


// ═══════════════════════════════════════════════════════════════════
// SUPABASE
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
// APPEL ANTHROPIC AVEC WEB SEARCH
// ═══════════════════════════════════════════════════════════════════

interface AnthropicResponse {
  content: Array<{
    type: "text" | "server_tool_use" | "web_search_tool_result";
    text?: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    server_tool_use?: {
      web_search_requests?: number;
    };
  };
}

async function callClaudeAuditor(userPrompt: string): Promise<{
  text: string;
  tokensInput: number;
  tokensOutput: number;
  webSearches: number;
}> {
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
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: MAX_WEB_SEARCHES_PER_PICK,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as AnthropicResponse;

    // La réponse peut contenir plusieurs blocs :
    //   - text (raisonnement initial)
    //   - server_tool_use (décision de chercher)
    //   - web_search_tool_result (résultats)
    //   - text (réponse finale avec JSON)
    // On prend le DERNIER bloc text (qui contient le JSON final)
    const textBlocks = data.content.filter((c) => c.type === "text" && c.text);
    const finalText = textBlocks[textBlocks.length - 1]?.text ?? "";

    const webSearches = data.usage?.server_tool_use?.web_search_requests ?? 0;

    return {
      text: finalText,
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
      webSearches,
    };
  } finally {
    clearTimeout(timeout);
  }
}


// ═══════════════════════════════════════════════════════════════════
// BUILD USER PROMPT
// ═══════════════════════════════════════════════════════════════════

function buildAuditPrompt(pick: PickToAudit): string {
  const eventDate = new Date(pick.event_date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (pick.pick_type === "scorer") {
    return `Vérifie ce pronostic de buteur en utilisant web_search :

Match : ${pick.event_name}
Ligue : ${pick.league}
Date : ${eventDate}
Joueur sélectionné : ${pick.selection}
Justification de l'IA : "${pick.reasoning}"

Utilise web_search pour vérifier :
  1. Dans quel club joue actuellement "${pick.selection}" ?
  2. Ce joueur est-il bien dans l'équipe dont il est censé être buteur ?

Si le joueur n'est plus dans l'équipe → rejette avec category="player_transferred".
Si tu ne trouves rien de concluant après tes recherches → valide.

Finis ta réponse par le JSON strict attendu.`;
  }

  return `Vérifie ce pronostic classique en utilisant web_search :

Match : ${pick.event_name}
Ligue : ${pick.league}
Date : ${eventDate}
Marché : ${pick.market}
Pick : ${pick.selection}
Justification de l'IA : "${pick.reasoning}"

Utilise web_search pour vérifier :
  1. Les équipes ${pick.event_name} évoluent-elles bien dans la ligue "${pick.league}" en 2025-2026 ?
  2. Si la justification mentionne un joueur, vérifie qu'il joue encore dans cette équipe.

Si une équipe n'est pas dans la bonne ligue → rejette avec category="team_relegated".
Si la justification cite un joueur transféré → rejette avec category="factual_error".

Finis ta réponse par le JSON strict attendu.`;
}


// ═══════════════════════════════════════════════════════════════════
// PARSE JSON
// ═══════════════════════════════════════════════════════════════════

function parseAuditResponse(text: string): {
  decision: "valid" | "rejected";
  reason: string | null;
  category: AuditDecision["category"];
} {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
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
  webSearches: number;
  error?: string;
}> {
  try {
    const prompt = buildAuditPrompt(pick);
    const { text, tokensInput, tokensOutput, webSearches } =
      await callClaudeAuditor(prompt);

    const parsed = parseAuditResponse(text);

    return {
      decision: {
        pickId: pick.id,
        decision: parsed.decision,
        reason: parsed.reason,
        category: parsed.category,
        webSearches,
      },
      tokensInput,
      tokensOutput,
      webSearches,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Audit] Erreur sur pick ${pick.id}: ${message}`);
    // Fail-safe : en cas d'erreur, on VALIDE par défaut
    return {
      decision: {
        pickId: pick.id,
        decision: "valid",
        reason: null,
        category: null,
        webSearches: 0,
      },
      tokensInput: 0,
      tokensOutput: 0,
      webSearches: 0,
      error: message,
    };
  }
}


// ═══════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════

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
    webSearchesTotal: 0,
    estimatedCostUsd: 0,
    durationMs: 0,
    errors,
  };

  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split("T")[0];

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

    console.log(`[Audit] ${picks.length} picks à auditer avec web search`);

    let totalTokensInput = 0;
    let totalTokensOutput = 0;
    let totalWebSearches = 0;

    // Audit séquentiel (évite rate limits)
    for (const pick of picks) {
      const result = await auditSinglePick(pick);
      report.decisions.push(result.decision);
      totalTokensInput += result.tokensInput;
      totalTokensOutput += result.tokensOutput;
      totalWebSearches += result.webSearches;

      if (result.error) {
        errors.push(`Pick ${pick.id}: ${result.error}`);
      }

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
          `[Audit] ❌ REJETÉ: ${pick.event_name} — ${pick.selection} — ${result.decision.reason} (${result.webSearches} recherches)`,
        );
      }
    }

    // Coûts
    const tokensTotal = totalTokensInput + totalTokensOutput;
    const tokenCost =
      (totalTokensInput / 1_000_000) * PRICE_INPUT_PER_MTOKENS +
      (totalTokensOutput / 1_000_000) * PRICE_OUTPUT_PER_MTOKENS;
    const searchCost = (totalWebSearches / 1000) * PRICE_WEB_SEARCH_PER_1000;
    const totalCost = tokenCost + searchCost;

    report.tokensUsed = tokensTotal;
    report.webSearchesTotal = totalWebSearches;
    report.estimatedCostUsd = totalCost;
    report.success = true;
    report.durationMs = Date.now() - startTime;

    // Log
    await supabase.from("ai_generation_logs").insert({
      run_type: "audit",
      run_date: today,
      status: errors.length > 0 ? "partial" : "success",
      picks_created: 0,
      picks_resolved: 0,
      errors_count: errors.length,
      errors: errors.length > 0 ? errors : null,
      tokens_used: tokensTotal,
      estimated_cost: totalCost,
      duration_ms: report.durationMs,
    });

    console.log(
      `[Audit] ✅ Terminé — ${report.validated}/${report.totalPicks} validés, ${report.rejected} rejetés, ${totalWebSearches} recherches ($${totalCost.toFixed(4)})`,
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