/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/cron/push-healthcheck (V2 — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V2 (11/05/2026) — Nettoyage legacy :
 *   - Plus de mise à jour de users.push_subscription. La colonne est
 *     orpheline (DROP COLUMN prévu 25/05/2026).
 *
 * Cron quotidien (1h UTC = 3h Paris) qui purge les push_subscriptions
 * zombies.
 *
 * Critères de purge :
 *   1. consecutive_failures >= 5
 *   2. last_seen_at < NOW() - 6 mois
 *   3. last_success_at IS NULL AND created_at < NOW() - 30 jours
 *
 * Pour chaque user dont on supprime la dernière sub, on coupe aussi
 * les flags catégorie + miroir tipster_notif_prefs.
 *
 * Path : src/app/api/cron/push-healthcheck/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ─── 1. Identifier les subs à purger ───
  const { data: failedSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, platform, consecutive_failures, last_seen_at")
    .gte("consecutive_failures", 5);

  const { data: staleSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, platform, consecutive_failures, last_seen_at")
    .lt("last_seen_at", sixMonthsAgo);

  const { data: orphanSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, platform, consecutive_failures, last_seen_at")
    .is("last_success_at", null)
    .lt("created_at", thirtyDaysAgo);

  // Dédupe par id
  const toDeleteMap = new Map<string, { id: string; user_id: string; endpoint: string; platform: string | null; reason: string }>();

  for (const s of failedSubs || []) {
    toDeleteMap.set(s.id, { ...s, reason: "consecutive_failures" });
  }
  for (const s of staleSubs || []) {
    if (!toDeleteMap.has(s.id)) {
      toDeleteMap.set(s.id, { ...s, reason: "stale_6months" });
    }
  }
  for (const s of orphanSubs || []) {
    if (!toDeleteMap.has(s.id)) {
      toDeleteMap.set(s.id, { ...s, reason: "never_succeeded_30d" });
    }
  }

  const toDelete = Array.from(toDeleteMap.values());
  const affectedUserIds = new Set(toDelete.map((s) => s.user_id));

  // ─── 2. Supprimer les subs ───
  let deleted = 0;
  if (toDelete.length > 0) {
    const ids = toDelete.map((s) => s.id);
    const { error: delErr } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .in("id", ids);
    if (delErr) {
      console.error("[push-healthcheck] delete failed", delErr);
    } else {
      deleted = ids.length;
    }
  }

  // ─── 3. Cleanup users sans plus aucune sub ───
  // V2 — Plus de maintenance users.push_subscription.
  const cleanedUsers: string[] = [];

  for (const userId of affectedUserIds) {
    const { count } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if ((count || 0) === 0) {
      await supabaseAdmin
        .from("users")
        .update({
          notify_push: false,
          notify_tipster_push: false,
          notify_abonnes_push: false,
        })
        .eq("id", userId);

      await supabaseAdmin
        .from("tipster_notif_prefs")
        .update({
          channel_push: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      cleanedUsers.push(userId);
    }
    // V2 — Sinon, plus rien à faire côté users (avant on rafraîchissait
    // users.push_subscription avec un autre device, devenu inutile).
  }

  // ─── 4. Reporting ───
  const breakdown = {
    consecutive_failures: toDelete.filter((s) => s.reason === "consecutive_failures").length,
    stale_6months: toDelete.filter((s) => s.reason === "stale_6months").length,
    never_succeeded_30d: toDelete.filter((s) => s.reason === "never_succeeded_30d").length,
  };

  await supabaseAdmin.from("notification_logs").insert({
    pick_id: null,
    user_id: null,
    channel: "healthcheck",
    status: deleted > 0 ? "sent" : "skipped",
    sent_at: new Date().toISOString(),
    error: null,
    platform: null,
    endpoint_domain: `deleted=${deleted} usersCut=${cleanedUsers.length}`,
    status_code: 200,
  });

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    deleted,
    affectedUsers: affectedUserIds.size,
    cleanedUsers: cleanedUsers.length,
    breakdown,
  });
}