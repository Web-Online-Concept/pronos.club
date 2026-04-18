/**
 * ═══════════════════════════════════════════════════════════════════
 * ROUTE DE TEST — /api/debug-odds
 * ═══════════════════════════════════════════════════════════════════
 *
 * TEMPORAIRE : à supprimer après validation.
 *
 * Usage : visite https://pronos.club/api/debug-odds
 *   → retourne un JSON avec les cotes récupérées
 *
 * ⚠️ Chaque appel consomme ~8-12 crédits sur le quota 500/mois.
 * Ne pas spammer (max 2-3 tests).
 * ═══════════════════════════════════════════════════════════════════
 */

import { NextResponse } from "next/server";
import { getAllOdds } from "@/lib/ai/odds-api-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();

  try {
    const result = await getAllOdds();
    const duration = Date.now() - startTime;

    // Résumé lisible : on ne dump pas tous les matchs (trop volumineux)
    // mais on montre un échantillon par sport
    const sample = result.matches.slice(0, 5).map((m) => ({
      id: m.id,
      sport_key: m.sport_key,
      event: `${m.home_team} vs ${m.away_team}`,
      commence_time: m.commence_time,
      bookmakers: m.bookmakers.map((b) => ({
        book: b.key,
        h2h: b.markets.h2h?.map((o) => `${o.name}:${o.price}`),
        totals: b.markets.totals?.map((o) => `${o.name} ${o.point}:${o.price}`),
      })),
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      stats: result.stats,
      total_matches: result.matches.length,
      sample_first_5_matches: sample,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err), duration_ms: Date.now() - startTime },
      { status: 500 },
    );
  }
}