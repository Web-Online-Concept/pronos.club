/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-generate-evening (V3.5 - drop soir)
 *
 * Pipeline tipster IA — drop soir (17h30 Paris).
 * Filtre les matchs avec kickoff >= 20h Paris (top affiches, NBA/NHL/MLB soirée USA, MMA).
 *
 * Évolutions V3.5 (09/05/2026) — NOUVEAU CRON :
 *   - Drop window = "evening" : matchs kickoff >= 20h Paris uniquement
 *   - Plafond strict : 4 picks max
 *   - Compositions probables confirmées à cette heure → meilleure data qu'au drop matin
 *   - Champ tier obligatoire dans chaque pick persisté
 *
 * AUTHENTIFICATION :
 *   - Header `Authorization: Bearer ${CRON_SECRET}` requis
 *
 * MODES :
 *   - GET / POST sans paramètre  → run normal, persiste en BDD
 *   - GET / POST ?dry_run=true   → run complet mais SANS insertion BDD (test)
 *   - GET / POST ?date=YYYY-MM-DD → run pour une date spécifique (replay)
 *
 * SCHEDULE VERCEL : 30 17 * * * (17h30 UTC = 19h30 ETE / 18h30 HIVER Paris)
 *   ⚠ Note : Vercel cron schedules sont en UTC, pas en heure Paris.
 *   Pour 17h30 Paris été (UTC+2) → schedule "30 15 * * *"
 *   Pour 17h30 Paris hiver (UTC+1) → schedule "30 16 * * *"
 *   Compromis : "30 15 * * *" (17h30 été, 16h30 hiver) OU adapter saisonnièrement.
 *   On utilise "30 15 * * *" par défaut (priorité été = saison sportive principale).
 */

import { NextRequest, NextResponse } from "next/server";
import { handleGenerateForDropWindow } from "@/lib/ai-picks-v3/ai-picks-generate-shared";

// ============================================================================
// CONFIGURATION NEXT.JS
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 800s = 13 minutes (max Vercel Pro)
// Le drop soir traite moins de matchs (4 max) mais le pipeline complet reste lourd
export const maxDuration = 800;

// ============================================================================
// EXPORTS NEXT.JS
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleGenerateForDropWindow(request, "evening");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleGenerateForDropWindow(request, "evening");
}