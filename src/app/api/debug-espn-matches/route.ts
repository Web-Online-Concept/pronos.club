/**
 * ═══════════════════════════════════════════════════════════════════
 * ROUTE DE TEST — /api/debug-espn-matches
 * ═══════════════════════════════════════════════════════════════════
 *
 * Ce fichier est TEMPORAIRE et sera supprimé après validation.
 *
 * Usage : visite https://pronos.club/api/debug-espn-matches
 *   → retourne un JSON avec les matchs ESPN récupérés
 *
 * Sert à valider que le client espn-matches.ts fonctionne en prod.
 * ═══════════════════════════════════════════════════════════════════
 */

import { NextResponse } from "next/server";
import { getAllTodayMatches, LEAGUES } from "@/lib/ai/espn-matches";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startTime = Date.now();

  try {
    const matches = await getAllTodayMatches();
    const duration = Date.now() - startTime;

    // Grouper les matchs par sport pour affichage propre
    const bySport = matches.reduce<Record<string, typeof matches>>((acc, m) => {
      if (!acc[m.sport]) acc[m.sport] = [];
      acc[m.sport].push(m);
      return acc;
    }, {});

    const summary = {
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      leagues_configured: LEAGUES.length,
      total_eligible_matches: matches.length,
      breakdown: {
        soccer: bySport.soccer?.length ?? 0,
        tennis: bySport.tennis?.length ?? 0,
        basketball: bySport.basketball?.length ?? 0,
      },
      matches: matches.map((m) => ({
        espn_id: m.espnEventId,
        league: m.league,
        sport: m.sport,
        event: m.eventName,
        date: m.eventDate,
        home: m.homeTeam,
        away: m.awayTeam,
        status: m.status,
      })),
    };

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: String(err),
        duration_ms: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}