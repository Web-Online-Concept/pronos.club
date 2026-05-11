/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/notifications/subscribe (V3.8 — fix detect platform — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V3.8 (11/05/2026) — Fix label "android" sur Chrome Desktop :
 *   - detectPlatform() croise désormais endpoint + User-Agent.
 *   - Chrome Desktop (Windows/Mac/Linux) utilise FCM comme Chrome Android,
 *     donc seul l'endpoint ne suffit pas → on regarde aussi l'UA.
 *   - Résultats possibles : ios | android | windows | macos | linux |
 *     firefox | other.
 *
 * V3.6 (11/05/2026) — Multi-device :
 *   - POST : UPSERT dans push_subscriptions par endpoint.
 *   - DELETE : supprime UNE sub par endpoint (ou TOUTES si pas fourni).
 *
 * V3.5 Lot 14 — Granularité par catégorie.
 *
 * Path : src/app/api/notifications/subscribe/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// ─── V3.8 — Détection plateforme croisée endpoint + User-Agent ───
function detectPlatform(endpoint: string, userAgent: string | null): string {
  // 1. Apple → toujours iOS (Safari iOS, pas de Mac WebPush courant via apple.com)
  if (endpoint.includes("push.apple.com")) return "ios";

  // 2. Mozilla → Firefox (peu importe l'OS, on garde "firefox" comme label)
  if (endpoint.includes("mozilla.com")) return "firefox";

  // 3. Windows Notification Service → Edge legacy / WNS
  if (endpoint.includes("windows.com") || endpoint.includes("notify.windows.com")) {
    return "windows";
  }

  // 4. FCM → Chrome (Desktop OU Android) OU Edge récent (Chromium). On regarde l'UA.
  if (endpoint.includes("fcm.googleapis.com") || endpoint.includes("android.googleapis.com")) {
    if (!userAgent) return "other";
    const ua = userAgent.toLowerCase();

    // Android tablet/phone (avant Windows car certains Android Phones rapportent Linux dans UA)
    if (ua.includes("android")) return "android";

    // Desktops
    if (ua.includes("windows")) return "windows";
    if (ua.includes("macintosh") || ua.includes("mac os x")) return "macos";
    if (ua.includes("cros")) return "chromeos"; // Chromebook
    if (ua.includes("linux")) return "linux";

    return "other";
  }

  return "other";
}

function extractEndpointHostname(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "unknown";
  }
}

// ═══════════════════════════════════════════════════════════════════
// POST : abonner le device courant
// ═══════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await request.json();

  if (
    !subscription ||
    typeof subscription !== "object" ||
    !subscription.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth
  ) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const endpoint: string = subscription.endpoint;
  const p256dh: string = subscription.keys.p256dh;
  const auth: string = subscription.keys.auth;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;
  const platform = detectPlatform(endpoint, userAgent); // V3.8

  let expirationTime: string | null = null;
  if (subscription.expirationTime && typeof subscription.expirationTime === "number") {
    expirationTime = new Date(subscription.expirationTime).toISOString();
  }

  const { error: subErr } = await supabaseAdmin
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        expiration_time: expirationTime,
        platform,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
        consecutive_failures: 0,
      },
      { onConflict: "endpoint" }
    );

  if (subErr) {
    console.error("[subscribe] upsert push_subscriptions failed", subErr);
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  const { error: userErr } = await supabaseAdmin
    .from("users")
    .update({
      push_subscription: subscription,
      notify_push: true,
      notify_tipster_push: true,
      notify_abonnes_push: true,
    })
    .eq("id", user.id);

  if (userErr) {
    console.error("[subscribe] miroir users failed", userErr);
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from("tipster_notif_prefs")
      .select("user_id, mode")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("tipster_notif_prefs")
        .update({
          channel_push: true,
          mode: existing.mode === "none" ? "selected" : existing.mode,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
      await supabaseAdmin
        .from("tipster_notif_prefs")
        .insert({
          user_id: user.id,
          mode: "selected",
          channel_email: true,
          channel_telegram: false,
          channel_push: true,
        });
    }
  } catch (e) {
    console.error("[subscribe] tipster_notif_prefs sync failed", e);
  }

  const endpointDomain = extractEndpointHostname(endpoint);
  await supabaseAdmin.from("notification_logs").insert({
    pick_id: null,
    user_id: user.id,
    channel: "subscribe",
    status: "sent",
    sent_at: new Date().toISOString(),
    error: null,
    platform,
    endpoint_domain: endpointDomain,
    status_code: 200,
  });

  return NextResponse.json({ ok: true, platform });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE : désabonner le device courant
// ═══════════════════════════════════════════════════════════════════
export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let endpoint: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && typeof body.endpoint === "string") {
      endpoint = body.endpoint;
    }
  } catch {
    // pas de body → on supprime tout
  }

  if (endpoint) {
    const { error: subErr } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
    if (subErr) console.error("[unsubscribe] delete by endpoint failed", subErr);
  } else {
    const { error: subErr } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id);
    if (subErr) console.error("[unsubscribe] delete all failed", subErr);
  }

  const { count } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const hasRemainingSubs = (count || 0) > 0;

  if (!hasRemainingSubs) {
    const { error: userErr } = await supabaseAdmin
      .from("users")
      .update({
        push_subscription: null,
        notify_push: false,
        notify_tipster_push: false,
        notify_abonnes_push: false,
      })
      .eq("id", user.id);

    if (userErr) console.error("[unsubscribe] miroir users failed", userErr);

    try {
      await supabaseAdmin
        .from("tipster_notif_prefs")
        .update({
          channel_push: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } catch (e) {
      console.error("[unsubscribe] tipster_notif_prefs sync failed", e);
    }
  } else if (endpoint) {
    const { data: remaining } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, expiration_time")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (remaining) {
      const miroirSubscription = {
        endpoint: remaining.endpoint,
        keys: { p256dh: remaining.p256dh, auth: remaining.auth },
        expirationTime: remaining.expiration_time
          ? new Date(remaining.expiration_time).getTime()
          : null,
      };
      await supabaseAdmin
        .from("users")
        .update({ push_subscription: miroirSubscription })
        .eq("id", user.id);
    }
  }

  await supabaseAdmin.from("notification_logs").insert({
    pick_id: null,
    user_id: user.id,
    channel: "unsubscribe",
    status: "sent",
    sent_at: new Date().toISOString(),
    error: null,
    platform: null,
    endpoint_domain: endpoint ? extractEndpointHostname(endpoint) : null,
    status_code: 200,
  });

  return NextResponse.json({
    ok: true,
    deletedEndpoint: endpoint || "all",
    remainingSubs: count || 0,
  });
}