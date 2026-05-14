// src/app/api/over-05/leagues/route.ts
//
// GET /api/over-05/leagues
// → Retourne la liste des 14 championnats disponibles pour l'outil O05.
//
// Auth : whitelist O05 (flotoulouse7@gmail.com + bertrandwebjob@yahoo.fr)
// Source : table o05_leagues (seed Phase 1)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";

export const dynamic = "force-dynamic";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export async function GET(_req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Récupérer les 14 championnats triés par display_order
  const { data: leagues, error } = await supabaseAdmin
    .from("o05_leagues")
    .select(`
      id,
      api_football_id,
      name,
      country,
      country_code,
      xg_source,
      understat_slug,
      sofascore_id,
      is_top5,
      display_order
    `)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[o05-leagues] DB error:", error.message);
    return NextResponse.json(
      { error: "Database error", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ leagues: leagues ?? [] });
}