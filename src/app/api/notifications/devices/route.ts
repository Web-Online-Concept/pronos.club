/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/notifications/devices (UI multi-device — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * GET : retourne la liste des push_subscriptions de l'user courant.
 * Utilisé par le composant DevicesList dans /espace/notifications.
 *
 * Sécurité : un user ne peut voir QUE ses propres subs (filtré par
 * user_id = requireAuth().id côté serveur).
 *
 * Path : src/app/api/notifications/devices/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select(
      "id, endpoint, platform, user_agent, created_at, last_seen_at, last_success_at, last_failure_at, consecutive_failures"
    )
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false });

  if (error) {
    console.error("[devices] select failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    devices: (subs || []).map((s) => ({
      id: s.id,
      endpoint: s.endpoint, // pour permettre au client de marquer "cet appareil"
      platform: s.platform || "other",
      user_agent: s.user_agent || null,
      created_at: s.created_at,
      last_seen_at: s.last_seen_at,
      last_success_at: s.last_success_at,
      last_failure_at: s.last_failure_at,
      consecutive_failures: s.consecutive_failures || 0,
    })),
  });
}