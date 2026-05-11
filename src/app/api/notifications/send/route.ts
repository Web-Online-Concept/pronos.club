/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/notifications/send (V3.6 multi-device — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V3.6 (11/05/2026) — Multi-device :
 *   - Itère sur push_subscriptions (un user peut avoir plusieurs subs
 *     simultanées : PC + Android PWA + iOS PWA).
 *   - Filtre : on JOIN push_subscriptions sur users avec
 *     users.notify_<category>_push = true.
 *   - Cleanup : sur 410/403/404, supprime UNIQUEMENT la sub par endpoint.
 *     Si après suppression il ne reste aucune sub pour le user, on coupe
 *     aussi le miroir users + flags + tipster_notif_prefs (cf. helper
 *     dans tipster-notifications.ts).
 *
 * V3.5 Lot 14 (10/05/2026) — historique :
 *   - Paramètre `category` au body : "tipster" | "abonnes"
 *
 * Path : src/app/api/notifications/send/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendNewPickEmail } from "@/lib/emails";
import { NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:contact@pronos.club",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string | null;
};

type Category = "tipster" | "abonnes";

function detectPlatformFromEndpoint(endpoint: string): { platform: string; domain: string } {
  try {
    const hostname = new URL(endpoint).hostname;
    if (endpoint.includes("push.apple.com"))     return { platform: "ios",     domain: hostname };
    if (endpoint.includes("fcm.googleapis.com")) return { platform: "android", domain: hostname };
    if (endpoint.includes("mozilla.com"))        return { platform: "firefox", domain: hostname };
    if (endpoint.includes("windows.com"))        return { platform: "windows", domain: hostname };
    return { platform: "other", domain: hostname };
  } catch {
    return { platform: "other", domain: "unknown" };
  }
}

// ─── Cleanup d'une sub morte (par endpoint) + miroirs si dernière ───
async function deleteDeadSubscription(userId: string, endpoint: string) {
  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

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
  } else {
    // Rafraîchir le miroir users.push_subscription avec une autre sub vivante
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

// ─── Envoi d'un push sur une sub précise ───
async function sendSinglePush(
  sub: SubRow,
  payload: string
): Promise<{ status: "sent" | "failed"; statusCode: number; error: string | null; platform: string; domain: string; shouldCleanup: boolean }> {
  const { platform, domain } = detectPlatformFromEndpoint(sub.endpoint);

  const webpushSub: webpush.PushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  try {
    await webpush.sendNotification(webpushSub, payload);
    return { status: "sent", statusCode: 201, error: null, platform, domain, shouldCleanup: false };
  } catch (err: unknown) {
    let statusCode = 0;
    let errorMsg = "unknown";
    let shouldCleanup = false;

    if (err && typeof err === "object") {
      if ("statusCode" in err) statusCode = (err as { statusCode: number }).statusCode;
      if ("message" in err) errorMsg = String((err as { message: string }).message).slice(0, 500);
      if ("body" in err) errorMsg = String((err as { body: string }).body).slice(0, 500);
    }

    if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
      shouldCleanup = true;
    }

    return { status: "failed", statusCode, error: errorMsg, platform, domain, shouldCleanup };
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pickId, pickNumber, sport, isPremium } = body;

  const category: Category = body.category === "abonnes" ? "abonnes" : "tipster";

  const pushToggleColumn = category === "abonnes" ? "notify_abonnes_push" : "notify_tipster_push";
  const emailToggleColumn = category === "abonnes" ? "notify_abonnes_email" : "notify_tipster_email";

  // ═════════════════════════════════════════════════════════════
  // V3.6 PUSH : sélection des destinataires
  // ═════════════════════════════════════════════════════════════
  // 1. Filtrer les users selon les flags catégorie + premium si besoin
  // 2. Récupérer TOUTES leurs subs depuis push_subscriptions

  let usersQuery = supabaseAdmin
    .from("users")
    .select("id")
    .eq(pushToggleColumn, true)
    .eq("notify_push", true); // kill switch global

  if (isPremium) {
    usersQuery = usersQuery.in("subscription_status", ["active", "trialing"]);
  }

  const { data: eligibleUsers } = await usersQuery;
  const eligibleUserIds = (eligibleUsers || []).map((u) => u.id);

  let pushSubs: SubRow[] = [];
  if (eligibleUserIds.length > 0) {
    const { data: subsData } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, platform")
      .in("user_id", eligibleUserIds);
    pushSubs = (subsData || []) as SubRow[];
  }

  // ═════════════════════════════════════════════════════════════
  // EMAIL : utilisateurs avec toggle email catégorie ON
  // ═════════════════════════════════════════════════════════════
  let emailQuery = supabaseAdmin
    .from("users")
    .select("id, email, locale")
    .eq(emailToggleColumn, true);

  if (isPremium) {
    emailQuery = emailQuery.in("subscription_status", ["active", "trialing"]);
  }

  const { data: emailUsers } = await emailQuery;

  let pushSent = 0;
  let pushFailed = 0;
  let pushCleaned = 0;
  let emailSent = 0;

  // ═════════════════════════════════════════════════════════════
  // PAYLOAD PUSH
  // ═════════════════════════════════════════════════════════════
  const titlePrefix = category === "abonnes" ? "👥" : "🔔";
  const urlPath = category === "abonnes" ? "/fr/pronos-abonnes" : "/fr/pronostics";

  const payload = JSON.stringify({
    title: pickNumber
      ? `${titlePrefix} #${pickNumber} Nouveau pronostic`
      : `${titlePrefix} Nouveau pronostic disponible`,
    body: sport ? `${sport} — Consultez-le sur PRONOS.CLUB` : "Un nouveau pick vient d'être publié",
    url: urlPath,
  });

  // ═════════════════════════════════════════════════════════════
  // ENVOI PUSH (multi-device)
  // ═════════════════════════════════════════════════════════════
  const logRows: Record<string, unknown>[] = [];
  // Map user_id → endpoints à cleanup (un user peut avoir plusieurs subs mortes)
  const cleanupByUser = new Map<string, string[]>();
  // Subs qui ont réussi → on met à jour last_success_at
  const successSubIds: string[] = [];

  await Promise.allSettled(
    pushSubs.map(async (sub) => {
      const result = await sendSinglePush(sub, payload);

      if (result.status === "sent") {
        pushSent++;
        successSubIds.push(sub.id);
      } else {
        pushFailed++;
        if (result.shouldCleanup) {
          const arr = cleanupByUser.get(sub.user_id) || [];
          arr.push(sub.endpoint);
          cleanupByUser.set(sub.user_id, arr);
          pushCleaned++;
        }
      }

      logRows.push({
        pick_id: pickId || null,
        user_id: sub.user_id,
        channel: "push",
        status: result.status,
        sent_at: new Date().toISOString(),
        error: result.error,
        platform: result.platform,
        endpoint_domain: result.domain,
        status_code: result.statusCode,
      });
    })
  );

  // ─── Cleanup des subs mortes (séquentiel par user pour cohérence miroir) ───
  for (const [userId, endpoints] of cleanupByUser) {
    for (const endpoint of endpoints) {
      try {
        await deleteDeadSubscription(userId, endpoint);
      } catch (e) {
        console.error("[send] cleanup failed", userId, endpoint, e);
      }
    }
  }

  // ─── Mise à jour last_success_at pour les subs OK ───
  if (successSubIds.length > 0) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({
        last_success_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        consecutive_failures: 0,
      })
      .in("id", successSubIds);
  }

  // ─── Insert logs en batch ───
  if (logRows.length > 0) {
    await supabaseAdmin.from("notification_logs").insert(logRows);
  }

  // ═════════════════════════════════════════════════════════════
  // ENVOI EMAILS
  // ═════════════════════════════════════════════════════════════
  if (emailUsers) {
    await Promise.allSettled(
      emailUsers.map(async (user) => {
        try {
          const locale = (user.locale as "fr" | "en" | "es") || "fr";
          const sent = await sendNewPickEmail(user.email, locale, sport, isPremium, pickNumber);
          if (sent) emailSent++;
        } catch {
          // Silent fail for individual emails
        }
      })
    );
  }

  // ═════════════════════════════════════════════════════════════
  // TELEGRAM (canal public Tipster — uniquement pour category="tipster")
  // ═════════════════════════════════════════════════════════════
  let telegramSent = false;
  if (
    category === "tipster" &&
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_CHANNEL_ID
  ) {
    try {
      const sportLabel = sport ? ` — ${sport}` : "";
      const accessLabel = isPremium ? "🔒 Premium" : "🆓 Gratuit";
      const pickLabel = pickNumber ? `#${pickNumber} ` : "";
      const telegramMessage = `🔔 ${pickLabel}Nouveau pronostic publié sur PRONOS.CLUB${sportLabel}\n${accessLabel}\n\n👉 ${process.env.NEXT_PUBLIC_SITE_URL}/fr/pronostics`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHANNEL_ID,
            text: telegramMessage,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          }),
        }
      );
      telegramSent = tgRes.ok;
    } catch {
      // Silent fail
    }
  }

  // Mark pick as notified
  if (pickId) {
    await supabaseAdmin
      .from("picks")
      .update({ notify_sent: true })
      .eq("id", pickId);
  }

  return NextResponse.json({
    category,
    pushSent,
    pushFailed,
    pushCleaned,
    emailSent,
    telegramSent,
    totalPushTargets: pushSubs.length,
    totalEligibleUsers: eligibleUserIds.length,
  });
}