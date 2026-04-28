// src/app/api/admin/ai-picks/resolve/route.ts
// Resolution manuelle d'un pick IA par admin
// Reproduit exactement ce que fait le resolver-v2 cron, mais avec resolution_source='manual_admin'

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["flotoulouse7@gmail.com", "jbrulard@yahoo.fr"];

const VALID_STATUSES = ["won", "half_won", "void", "half_lost", "lost"] as const;
type ValidStatus = typeof VALID_STATUSES[number];

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  // Verifier que le pick existe et est encore pending
  const { data: pick, error: fetchErr } = await supabaseAdmin
    .from("ai_picks")
    .select("id, status, event_name, event_date")
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

  // Update : reproduit la signature de updatePickResolution du resolver-v2
  const { error: updateErr } = await supabaseAdmin
    .from("ai_picks")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      resolution_source: "manual_admin",
    })
    .eq("id", pickId);

  if (updateErr) {
    console.error("[admin-ai-picks-resolve] update error:", updateErr);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  console.log(
    `[admin-ai-picks-resolve] Pick ${pickId} (${pick.event_name}) resolved as ${status} by ${user.email}`
  );

  return NextResponse.json({
    success: true,
    pickId,
    status,
    eventName: pick.event_name,
  });
}

export async function GET(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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