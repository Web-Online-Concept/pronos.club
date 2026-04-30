// src/app/api/admin/ai-picks/resolve/route.ts
// Resolution manuelle d'un pick IA par admin
// Reproduit exactement ce que fait le resolver-v2 cron, mais avec resolution_source='manual_admin'
//
// v3 (avril 2026) : ajout du calcul automatique du profit en base lors de la
// resolution. Stake fixe = 1U pour les Pronos IA. Logique partagee avec
// resolver-v2 via /lib/ai-picks-v2/compute-profit.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeProfit, type ResolutionStatus } from "@/lib/ai-picks-v2/compute-profit";

const ADMIN_EMAILS = ["flotoulouse7@gmail.com", "jbrulard@yahoo.fr"];

const VALID_STATUSES = ["won", "half_won", "void", "half_lost", "lost"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];


export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: { pickId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pickId, status } = body;

  if (!pickId || typeof pickId !== "string") {
    return NextResponse.json({ error: "Missing pickId" }, { status: 400 });
  }

  if (!status || !VALID_STATUSES.includes(status as ValidStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Verifier que le pick existe et est encore pending + recuperer la cote
  const { data: pick, error: fetchErr } = await supabaseAdmin
    .from("ai_picks")
    .select("id, status, event_name, event_date, odds")
    .eq("id", pickId)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  if (pick.status !== "pending") {
    return NextResponse.json(
      { error: `Pick already resolved (status: ${pick.status})` },
      { status: 409 }
    );
  }

  // Calcul du profit selon status + cote (stake = 1U)
  // Helper partage avec le cron resolver-v2 pour eviter toute divergence.
  const profit = computeProfit(status as ResolutionStatus, pick.odds);

  // Update : reproduit la signature de updatePickResolution du resolver-v2
  // + ajout du profit calcule + tracking de qui a resolu
  const { error: updateErr } = await supabaseAdmin
    .from("ai_picks")
    .update({
      status,
      profit,
      resolved_at: new Date().toISOString(),
      resolution_source: "manual_admin",
      resolved_by: user.email,
    })
    .eq("id", pickId);

  if (updateErr) {
    console.error("[admin-ai-picks-resolve] update error:", updateErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  console.log(
    `[admin-ai-picks-resolve] Pick ${pickId} (${pick.event_name}) resolved as ${status} by ${user.email}, profit=${profit}U`
  );

  return NextResponse.json({
    success: true,
    pickId,
    status,
    profit,
    eventName: pick.event_name,
  });
}


export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Liste des picks pending dont le match est passe
  const { data: picks, error } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, classic_number, sport, league, event_name, event_date, selection, market, odds, pick_type, generation_version, resolution_source, status"
    )
    .eq("status", "pending")
    .is("deleted_at", null)
    .lt("event_date", new Date().toISOString())
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[admin-ai-picks-resolve] fetch error:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }

  return NextResponse.json({ picks: picks ?? [] });
}