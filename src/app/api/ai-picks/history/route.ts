/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/ai-picks/history (V3.5 — fix pagination)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Endpoint API qui alimente la page /pronos-ia/historique.
 *
 * V3.5 (09/05/2026) :
 *   - Ajout `tier` + `drop_window` dans le SELECT
 *   - Ajout query param `tier` (lock | strong | value | coup_de_coeur)
 *   - FIX PAGINATION : on ne fait plus de filtrage post-query côté JS,
 *     tout passe par Supabase pour que `count` soit cohérent avec les
 *     données paginées. Avant le fix, `count` retourné = taille du
 *     batch courant au lieu du total → bouton "Charger plus" jamais
 *     affiché alors qu'il y avait plus de picks.
 *
 * Path : src/app/api/ai-picks/history/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sportSlug = searchParams.get("sport");
  // V3.5 : filtre par tier
  const tier = searchParams.get("tier");

  const isCountOnly = limit === 0;

  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      // V3.5 : ajout `tier` et `drop_window` pour la card et le filtre
      "id, ai_pick_number, classic_number, scorer_number, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, reasoning, ai_confidence, status, final_score, profit, slug, consensus_tier, consensus_score, live_score_data, deleted_at, tier, drop_window",
      { count: "exact" }
    )
    .is("deleted_at", null)
    // Module Buteurs supprime : on n'expose que les picks classiques
    .eq("pick_type", "classic")
    // Tri : created_at desc + classic_number desc en fallback (bulk insert IA)
    .order("created_at", { ascending: false })
    .order("classic_number", { ascending: false, nullsFirst: false });

  // ─── FILTRE STATUS ──────────────────────────────────────────────
  // Logique :
  //   - status="awaiting" → picks pending dont event_date est PASSÉE
  //     (= en attente de résolution malgré le coup d'envoi passé)
  //   - status="won" / "lost" / "void" → filtrage exact
  //   - status absent (= "all" côté client après V3.5 fix) → on retourne
  //     TOUS les picks (résolus + pending). Pas de filtrage JS.
  if (status === "awaiting") {
    const nowIso = new Date().toISOString();
    query = query.eq("status", "pending").lte("event_date", nowIso);
  } else if (status === "won" || status === "lost" || status === "void") {
    query = query.eq("status", status);
  }

  if (from) query = query.gte("event_date", `${from}T00:00:00Z`);
  if (to) query = query.lte("event_date", `${to}T23:59:59Z`);

  if (sportSlug && sportSlug !== "all") {
    query = query.eq("sport", sportSlug);
  }

  // V3.5 : filtre tier
  if (tier && tier !== "all") {
    query = query.eq("tier", tier);
  }

  // ─── PAGINATION ─────────────────────────────────────────────────
  // CRITIQUE : `range()` doit être appelé APRÈS tous les filtres pour
  // que `count` retourne le total après filtres et pas avant.
  if (!isCountOnly) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isCountOnly) {
    return NextResponse.json({ data: [], count: count ?? 0 });
  }

  // V3.5 : `count` est désormais TOUJOURS le total Supabase après filtres.
  // Plus de filtrage post-query JS qui faisait foirer le compteur.
  return NextResponse.json({
    data: data ?? [],
    count: count ?? 0,
  });
}