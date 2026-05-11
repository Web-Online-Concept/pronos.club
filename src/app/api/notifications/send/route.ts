/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/notifications/send (V3.5 Lot 14 + fix bugs notif 11/05/26)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V3.5 Lot 14 (10/05/2026) :
 *   - Ajout paramètre `category` au body : "tipster" | "abonnes"
 *   - Filtre les destinataires selon le toggle correspondant :
 *     · category="tipster" → notify_tipster_push / notify_tipster_email
 *     · category="abonnes" → notify_abonnes_push / notify_abonnes_email
 *   - Rétrocompat : si category n'est pas fourni, défaut "tipster"
 *     (comportement historique pour les anciens appels)
 *
 * Fix bugs notif (11/05/2026) :
 *   - Bug A — Cleanup batch des subs mortes maintenant COMPLET :
 *     coupe push_subscription + tous les flags catégories users + miroir
 *     tipster_notif_prefs.channel_push. Avant ce fix, tipster_notif_prefs
 *     restait à channel_push=true → Section 5 affichait ON sans sub
 *     physique.
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

type PushUser = {
  id: string;
  push_subscription: webpush.PushSubscription;
};

type Category = "tipster" | "abonnes";

function detectPlatform(endpoint: string): { platform: string; domain: string } {
  try {
    const hostname = new URL(endpoint).hostname;
    if (endpoint.includes("push.apple.com")) return { platform: "ios", domain: hostname };
    if (endpoint.includes("fcm.googleapis.com")) return { platform: "android", domain: hostname };
    if (endpoint.includes("mozilla.com")) return { platform: "firefox", domain: hostname };
    if (endpoint.includes("windows.com")) return { platform: "windows", domain: hostname };
    return { platform: "other", domain: hostname };
  } catch {
    return { platform: "other", domain: "unknown" };
  }
}

async function sendSinglePush(
  user: PushUser,
  payload: string,
  pickId: string | null
): Promise<{ status: "sent" | "failed"; statusCode: number; error: string | null; platform: string; domain: string; shouldCleanup: boolean }> {
  const endpoint = user.push_subscription.endpoint;
  const { platform, domain } = detectPlatform(endpoint);

  try {
    await webpush.sendNotification(user.push_subscription, payload);
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

  // V3.5 Lot 14 — détermine la catégorie pour le filtrage des toggles
  // Si non fourni, défaut "tipster" (rétrocompat avec les anciens appels)
  const category: Category = body.category === "abonnes" ? "abonnes" : "tipster";

  // Détermine quels toggles vérifier selon la catégorie
  const pushToggleColumn = category === "abonnes" ? "notify_abonnes_push" : "notify_tipster_push";
  const emailToggleColumn = category === "abonnes" ? "notify_abonnes_email" : "notify_tipster_email";

  // ═════════════════════════════════════════════════════════════
  // PUSH : utilisateurs avec push_subscription + toggle catégorie ON
  // ═════════════════════════════════════════════════════════════
  let pushQuery = supabaseAdmin
    .from("users")
    .select("id, push_subscription")
    .eq(pushToggleColumn, true)
    .not("push_subscription", "is", null);

  if (isPremium) {
    pushQuery = pushQuery.in("subscription_status", ["active", "trialing"]);
  }

  const { data: pushUsersRaw } = await pushQuery;
  const pushUsers = (pushUsersRaw || []) as PushUser[];

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
  // ENVOI PUSH
  // ═════════════════════════════════════════════════════════════
  const logRows: Record<string, unknown>[] = [];
  const cleanupIds: string[] = [];

  await Promise.allSettled(
    pushUsers.map(async (user) => {
      const result = await sendSinglePush(user, payload, pickId || null);

      if (result.status === "sent") {
        pushSent++;
      } else {
        pushFailed++;
        if (result.shouldCleanup) {
          cleanupIds.push(user.id);
          pushCleaned++;
        }
      }

      logRows.push({
        pick_id: pickId || null,
        user_id: user.id,
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

  // ═════════════════════════════════════════════════════════════
  // CLEANUP des subs mortes (fix bug A — cleanup COMPLET)
  // ═════════════════════════════════════════════════════════════
  // Avant ce fix : on coupait users.notify_* mais tipster_notif_prefs.channel_push
  // restait à true → Section 5 affichait ON sans sub physique.
  if (cleanupIds.length > 0) {
    await supabaseAdmin
      .from("users")
      .update({
        push_subscription: null,
        notify_push: false,
        notify_tipster_push: false,
        notify_abonnes_push: false,
      })
      .in("id", cleanupIds);

    // Miroir tipster_notif_prefs (Section 5 UI lit ici)
    await supabaseAdmin
      .from("tipster_notif_prefs")
      .update({
        channel_push: false,
        updated_at: new Date().toISOString(),
      })
      .in("user_id", cleanupIds);
  }

  // Insert all log rows in one batch
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
  // Pour category="abonnes", c'est tipster-notifications.ts qui s'occupe
  // de publier sur le canal public Pronos Abonnés.
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
    totalPushTargets: pushUsers.length,
  });
}