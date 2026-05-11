/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/cron/push-healthcheck (11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Cron quotidien (1h UTC = 3h Paris) qui purge les push_subscriptions
 * zombies pour garder la table propre et éviter les envois inutiles.
 *
 * Critères de purge :
 *   1. consecutive_failures >= 5
 *      (5 échecs d'affilée non-410 → sub probablement cassée, on coupe)
 *   2. last_seen_at < NOW() - 6 mois
 *      (user n'a pas réutilisé son device depuis 6 mois → on suppose mort)
 *   3. last_success_at IS NULL AND created_at < NOW() - 30 jours
 *      (sub jamais utilisée avec succès depuis 30 jours → mort-né)
 *
 * Pour chaque user dont on supprime la dernière sub, on coupe aussi
 * les flags catégorie + miroir tipster_notif_prefs (comme
 * cleanupDeadSubscription).
 *
 * Auth : Bearer CRON_SECRET (standard Vercel cron).
 *
 * Path : src/app/api/cron/push-healthcheck/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Auth Vercel cron
  const authHeader = request.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ─── 1. Identifier les subs à purger ───
  // On collecte les id + user_id pour pouvoir ensuite vérifier les users
  // dont c'était la dernière sub.

  // Critère 1 : consecutive_failures >= 5
  const { data: failedSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, platform, consecutive_failures, last_seen_at")
    .gte("consecutive_failures", 5);

  // Critère 2 : last_seen_at < 6 mois
  const { data: staleSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, platform, consecutive_failures, last_seen_at")
    .lt("last_seen_at", sixMonthsAgo);

  // Critère 3 : last_success_at NULL ET created_at < 30 jours
  const { data: orphanSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, platform, consecutive_failures, last_seen_at")
    .is("last_success_at", null)
    .lt("created_at", thirtyDaysAgo);

  // Dédupe par id (un même sub peut matcher plusieurs critères)
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
  // Pour chaque user affecté, on vérifie s'il lui reste des subs.
  // Si non, on coupe les flags catégorie + miroir tipster_notif_prefs.
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
          push_subscription: null,
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
    } else {
      // Il reste des subs : rafraîchir le miroir users.push_subscription avec
      // une autre sub vivante (rétrocompat envoyeurs)
      const { data: remaining } = await supabaseAdmin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, expiration_time")
        .eq("user_id", userId)
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
          .eq("id", userId);
      }
    }
  }

  // ─── 4. Reporting ───
  const breakdown = {
    consecutive_failures: toDelete.filter((s) => s.reason === "consecutive_failures").length,
    stale_6months: toDelete.filter((s) => s.reason === "stale_6months").length,
    never_succeeded_30d: toDelete.filter((s) => s.reason === "never_succeeded_30d").length,
  };

  // Log compteur dans notification_logs pour avoir une trace historique
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