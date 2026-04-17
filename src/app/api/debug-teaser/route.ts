import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Endpoint de DEBUG pour diagnostiquer pourquoi teaserPick retourne null en prod
// À SUPPRIMER une fois le diagnostic terminé
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env_check: {
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      service_role_key_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    },
  };

  try {
    // TEST 1 : Compter tous les picks (sanity check Supabase)
    const { count: totalPicks, error: countError } = await supabaseAdmin
      .from("picks")
      .select("id", { count: "exact", head: true });

    diagnostics.test_1_count_all_picks = {
      total: totalPicks,
      error: countError?.message ?? null,
    };
  } catch (err) {
    diagnostics.test_1_error = String(err);
  }

  try {
    // TEST 2 : Compter les picks gratuits
    const { count: freePicks, error: freeError } = await supabaseAdmin
      .from("picks")
      .select("id", { count: "exact", head: true })
      .eq("is_premium", false);

    diagnostics.test_2_count_free_picks = {
      total: freePicks,
      error: freeError?.message ?? null,
    };
  } catch (err) {
    diagnostics.test_2_error = String(err);
  }

  try {
    // TEST 3 : Pick gratuit pending (comme ma fonction getCachedTeaserPick)
    const { data: pendingFree, error: pendingError } = await supabaseAdmin
      .from("picks")
      .select(
        "id, event_name, selection, odds, stake, analysis_fr, analysis_en, analysis_es, event_date, status, sport:sports(name_fr, name_en, name_es, icon)"
      )
      .eq("is_premium", false)
      .eq("status", "pending")
      .gt("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    diagnostics.test_3_pending_free = {
      found: !!pendingFree,
      data: pendingFree,
      error: pendingError?.message ?? null,
    };
  } catch (err) {
    diagnostics.test_3_error = String(err);
  }

  try {
    // TEST 4 : Pick gratuit gagné (fallback)
    const { data: lastWon, error: wonError } = await supabaseAdmin
      .from("picks")
      .select(
        "id, event_name, selection, odds, stake, analysis_fr, analysis_en, analysis_es, event_date, status, sport:sports(name_fr, name_en, name_es, icon)"
      )
      .eq("is_premium", false)
      .in("status", ["won", "half_won"])
      .order("result_entered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    diagnostics.test_4_last_won = {
      found: !!lastWon,
      data: lastWon,
      error: wonError?.message ?? null,
    };
  } catch (err) {
    diagnostics.test_4_error = String(err);
  }

  try {
    // TEST 5 : Même requête SANS le .eq sport pour voir si c'est le join qui pose problème
    const { data: simpleWon, error: simpleError } = await supabaseAdmin
      .from("picks")
      .select("id, event_name, selection, odds, stake, status, is_premium")
      .eq("is_premium", false)
      .in("status", ["won", "half_won"])
      .order("result_entered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    diagnostics.test_5_simple_won_no_join = {
      found: !!simpleWon,
      data: simpleWon,
      error: simpleError?.message ?? null,
    };
  } catch (err) {
    diagnostics.test_5_error = String(err);
  }

  return NextResponse.json(diagnostics, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}