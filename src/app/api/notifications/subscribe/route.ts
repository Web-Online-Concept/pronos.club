/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/notifications/subscribe (V3.5 Lot 14)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V3.5 Lot 14 (10/05/2026) :
 *   - Quand l'utilisateur souscrit au push browser, on active automatiquement
 *     les 3 toggles : notify_push (global) + notify_tipster_push +
 *     notify_abonnes_push.
 *   - Logique : 1 seul abonnement push physique partagé entre les catégories.
 *     Les toggles déterminent qui reçoit quoi côté serveur.
 *   - Quand l'utilisateur désinscrit, tous les toggles push sont remis à false.
 *
 * Path : src/app/api/notifications/subscribe/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function detectPlatform(endpoint: string): string {
  if (endpoint.includes("push.apple.com")) return "ios";
  if (endpoint.includes("fcm.googleapis.com")) return "android";
  if (endpoint.includes("mozilla.com")) return "firefox";
  if (endpoint.includes("windows.com")) return "windows";
  return "other";
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await request.json();

  if (!subscription || typeof subscription !== "object" || !subscription.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      push_subscription: subscription,
      // V3.5 Lot 14 — activation simultanée du global + des 2 catégories
      notify_push: true,
      notify_tipster_push: true,
      notify_abonnes_push: true,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log la souscription (utile pour savoir quand un user s'est (re-)abonné)
  const platform = detectPlatform(subscription.endpoint);
  await supabaseAdmin.from("notification_logs").insert({
    pick_id: null,
    user_id: user.id,
    channel: "subscribe",
    status: "sent",
    sent_at: new Date().toISOString(),
    error: null,
    platform,
    endpoint_domain: platform,
    status_code: 200,
  });

  return NextResponse.json({ ok: true, platform });
}

export async function DELETE() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      push_subscription: null,
      // V3.5 Lot 14 — désactivation simultanée du global + des 2 catégories
      notify_push: false,
      notify_tipster_push: false,
      notify_abonnes_push: false,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log la désinscription
  await supabaseAdmin.from("notification_logs").insert({
    pick_id: null,
    user_id: user.id,
    channel: "unsubscribe",
    status: "sent",
    sent_at: new Date().toISOString(),
    error: null,
    platform: null,
    endpoint_domain: null,
    status_code: 200,
  });

  return NextResponse.json({ ok: true });
}