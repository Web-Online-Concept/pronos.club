/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/notifications/send (V4.1 — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V4.1 (11/05/2026) — Nettoyage legacy :
 *   - deleteDeadSubscription ne met plus à jour users.push_subscription.
 *     La colonne est devenue orpheline (DROP COLUMN prévu 25/05/2026).
 *
 * V4.0 (11/05/2026) — Lit sub.platform au lieu de redétecter.
 * V3.7 (11/05/2026) — Email logging avec userId.
 * V3.6 (11/05/2026) — Multi-device push.
 * V3.5 Lot 14         — Paramètre `category` au body.
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

function extractEndpointHostname(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "unknown";
  }
}

async function deleteDeadSubscription(userId: string, endpoint: string) {
  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  const { count } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // V4.1 — Si plus aucune sub : on coupe juste les flags catégorie.
  // Plus de maintenance de users.push_subscription (orphan).
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
  }
  // V4.1 — Si il reste des subs, plus rien à faire côté users
  // (avant on rafraîchissait users.push_subscription avec un autre device).
}

async function sendSinglePush(
  sub: SubRow,
  payload: string
): Promise<{
  status: "sent" | "failed";
  statusCode: number;
  error: string | null;
  platform: string;
  domain: string;
  shouldCleanup: boolean;
}> {
  const platform = sub.platform || "other";
  const domain = extractEndpointHostname(sub.endpoint);

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

  let usersQuery = supabaseAdmin
    .from("users")
    .select("id")
    .eq(pushToggleColumn, true)
    .eq("notify_push", true);

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

  const titlePrefix = category === "abonnes" ? "👥" : "🔔";
  const urlPath = category === "abonnes" ? "/fr/pronos-abonnes" : "/fr/pronostics";

  const payload = JSON.stringify({
    title: pickNumber
      ? `${titlePrefix} #${pickNumber} Nouveau pronostic`
      : `${titlePrefix} Nouveau pronostic disponible`,
    body: sport ? `${sport} — Consultez-le sur PRONOS.CLUB` : "Un nouveau pick vient d'être publié",
    url: urlPath,
  });

  const logRows: Record<string, unknown>[] = [];
  const cleanupByUser = new Map<string, string[]>();
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

  for (const [userId, endpoints] of cleanupByUser) {
    for (const endpoint of endpoints) {
      try {
        await deleteDeadSubscription(userId, endpoint);
      } catch (e) {
        console.error("[send] cleanup failed", userId, endpoint, e);
      }
    }
  }

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

  if (logRows.length > 0) {
    await supabaseAdmin.from("notification_logs").insert(logRows);
  }

  if (emailUsers) {
    await Promise.allSettled(
      emailUsers.map(async (user) => {
        try {
          const locale = (user.locale as "fr" | "en" | "es") || "fr";
          const sent = await sendNewPickEmail(user.email, locale, sport, isPremium, pickNumber, user.id);
          if (sent) emailSent++;
        } catch {
          // Silent fail
        }
      })
    );
  }

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