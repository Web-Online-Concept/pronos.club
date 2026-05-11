// src/lib/tipster-notifications.ts
// Envoie les notifications aux followers quand un tipster publie un pick
// 3 canaux : Email (Brevo via emails.ts) + Telegram (canal public) + Push (multi-device)
//
// V3.6 (11/05/2026) — Multi-device :
//   - Push : itère sur push_subscriptions (un user peut avoir plusieurs
//     subs simultanées : PC + Android PWA + iOS PWA)
//   - Cleanup : supprime UNIQUEMENT la sub par endpoint sur 410/403/404.
//     Les autres subs du même user restent actives.
//   - Si après cleanup il ne reste AUCUNE sub pour le user, on coupe
//     aussi le miroir users.push_subscription + flags catégories +
//     tipster_notif_prefs.channel_push.
//
// V3.5 (10/05/2026) — historique :
//   - Suppression des DM Telegram aux abonnés (canal public conservé)
//
// Fix bugs notif (11/05/2026) — historique :
//   - Helper cleanupDeadSubscription exporté, partagé avec les autres
//     envoyeurs.

import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { sendTipsterNewPickEmail } from "@/lib/emails";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:contact@pronos.club",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const TELEGRAM_BOT_TOKEN = process.env.TIPSTERS_TELEGRAM_BOT_TOKEN;
const TELEGRAM_PUBLIC_CHANNEL = process.env.TIPSTERS_TELEGRAM_CHANNEL;

type Pick = {
  id: string;
  user_id: string;
  sport: string;
  odds: number;
  pick_type: string;
  match_date: string;
  bookmaker?: string | null;
};

type Tipster = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string | null;
};

// ═══════════════════════════════════════════════════════════════════
// Helper : cleanup d'UNE sub morte (par endpoint)
// ═══════════════════════════════════════════════════════════════════
// V3.6 : supprime UNIQUEMENT la sub concernée. Si après suppression il
// n'en reste aucune pour ce user, on coupe aussi le miroir users +
// flags catégories + tipster_notif_prefs.
async function deleteDeadSubscriptionByEndpoint(userId: string, endpoint: string) {
  // 1. Supprime la sub précise
  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  // 2. Compte ce qui reste pour ce user
  const { count } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // 3. Si plus aucune sub : coupe le miroir users + flags + tipster_notif_prefs
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
    // Il reste des subs : on rafraîchit le miroir users.push_subscription
    // avec une autre sub vivante (pour rétrocompat avec ce qui lirait
    // encore users.push_subscription)
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

// ═══════════════════════════════════════════════════════════════════
// Helper EXPORTÉ : cleanup complet de toutes les subs d'un user
// ═══════════════════════════════════════════════════════════════════
// Utilisé par /api/admin/push-test quand le user a une sub manifestement
// morte et qu'on veut tout nettoyer d'un coup.
// V3.6 : supprime toutes les push_subscriptions + miroir + flags.
export async function cleanupDeadSubscription(userId: string) {
  // 1. Supprime toutes les subs du user
  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);

  // 2. Coupe miroir users + flags catégories
  await supabaseAdmin
    .from("users")
    .update({
      push_subscription: null,
      notify_push: false,
      notify_tipster_push: false,
      notify_abonnes_push: false,
    })
    .eq("id", userId);

  // 3. Coupe tipster_notif_prefs
  await supabaseAdmin
    .from("tipster_notif_prefs")
    .update({
      channel_push: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

// ── Helper Telegram ──
async function sendTelegramMessage(chatId: string | number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
  } catch (err) {
    console.error("[telegram] error:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Helper Push V3.6 — multi-device
// ═══════════════════════════════════════════════════════════════════
// Lit TOUTES les push_subscriptions du user et envoie une notif par sub.
// Filtre garde-fou : users.notify_push doit être true (kill switch global).
async function sendPushToUser(userId: string, payload: any) {
  try {
    // Kill switch global
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("notify_push")
      .eq("id", userId)
      .single();

    if (!user || !user.notify_push) return;

    // Toutes les subs vivantes du user
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, platform")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) return;

    const payloadStr = JSON.stringify(payload);

    // Envoi en parallèle sur tous les devices
    await Promise.allSettled(
      (subs as PushSubscriptionRow[]).map(async (sub) => {
        const webpushSub: webpush.PushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        try {
          await webpush.sendNotification(webpushSub, payloadStr);

          // Succès : on met à jour last_success_at + reset failures
          await supabaseAdmin
            .from("push_subscriptions")
            .update({
              last_success_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
              consecutive_failures: 0,
            })
            .eq("id", sub.id);
        } catch (err: any) {
          const statusCode = err?.statusCode || 0;

          // Subscription morte : supprime CE device uniquement
          if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
            await deleteDeadSubscriptionByEndpoint(userId, sub.endpoint);
          } else {
            // Erreur transitoire : incrémente compteur d'échecs
            await supabaseAdmin
              .from("push_subscriptions")
              .update({
                last_failure_at: new Date().toISOString(),
                consecutive_failures: ((sub as any).consecutive_failures || 0) + 1,
              })
              .eq("id", sub.id);
          }
        }
      })
    );
  } catch (err) {
    console.error("[push] error:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Main : envoie les notifs pour un nouveau pick
// ═══════════════════════════════════════════════════════════════════
export async function notifyFollowersOfNewPick(pick: Pick, tipster: Tipster) {
  const matchDate = new Date(pick.match_date);
  const matchDateStr = matchDate.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  const publicUrl = `https://pronos.club/fr/pronos-abonnes/en-cours`;

  // ═════════════════════════════════════
  // 1. CANAL PUBLIC TELEGRAM
  // ═════════════════════════════════════
  if (TELEGRAM_PUBLIC_CHANNEL) {
    const publicMsg =
      `🎯 <b>Nouveau prono de ${tipster.pseudo}</b>\n\n` +
      `📅 ${matchDateStr}\n` +
      `🏅 ${pick.sport}\n\n` +
      `👉 <a href="${publicUrl}">pronos.club/fr/pronos-abonnes/en-cours</a>`;
    await sendTelegramMessage(TELEGRAM_PUBLIC_CHANNEL, publicMsg);
  }

  // ═════════════════════════════════════
  // 2. NOTIFS PERSONNALISEES AUX ABONNES
  // ═════════════════════════════════════
  const { data: allModeUsers } = await supabaseAdmin
    .from("tipster_notif_prefs")
    .select(`
      user_id,
      mode,
      channel_email,
      channel_telegram,
      channel_push,
      users:user_id (id, pseudo, email, subscription_status, tipsters_telegram_chat_id)
    `)
    .eq("mode", "all");

  const { data: followers } = await supabaseAdmin
    .from("tipster_follows")
    .select(`
      follower_id,
      channel_email,
      channel_telegram,
      channel_push,
      user:follower_id (
        id,
        pseudo,
        email,
        subscription_status,
        tipsters_telegram_chat_id
      )
    `)
    .eq("tipster_id", tipster.id);

  const toNotify = new Map<string, {
    userId: string;
    pseudo: string;
    email: string;
    premium: boolean;
    telegramChatId: number | null;
    useEmail: boolean;
    useTelegram: boolean;
    usePush: boolean;
  }>();

  // Mode "all"
  for (const pref of allModeUsers || []) {
    const u = (pref as any).users;
    if (!u) continue;
    if (u.id === tipster.id) continue;
    const premium = u.subscription_status === "active" || u.subscription_status === "trialing";
    if (!premium) continue;

    toNotify.set(u.id, {
      userId: u.id,
      pseudo: u.pseudo || "",
      email: u.email || "",
      premium,
      telegramChatId: u.tipsters_telegram_chat_id || null,
      useEmail: pref.channel_email,
      useTelegram: pref.channel_telegram,
      usePush: pref.channel_push,
    });
  }

  // Mode "selected"
  const followerIds = (followers || []).map((f: any) => f.follower_id);
  if (followerIds.length > 0) {
    const { data: followerPrefs } = await supabaseAdmin
      .from("tipster_notif_prefs")
      .select("user_id, mode, channel_email, channel_telegram, channel_push")
      .in("user_id", followerIds)
      .eq("mode", "selected");

    const prefsMap = new Map<string, any>();
    for (const p of followerPrefs || []) {
      prefsMap.set(p.user_id, p);
    }

    for (const follow of followers || []) {
      const u = (follow as any).user;
      if (!u) continue;
      if (u.id === tipster.id) continue;
      if (toNotify.has(u.id)) continue;

      const premium = u.subscription_status === "active" || u.subscription_status === "trialing";
      if (!premium) continue;

      const globalPref = prefsMap.get(u.id);
      if (!globalPref) continue;

      toNotify.set(u.id, {
        userId: u.id,
        pseudo: u.pseudo || "",
        email: u.email || "",
        premium,
        telegramChatId: u.tipsters_telegram_chat_id || null,
        useEmail: globalPref.channel_email && follow.channel_email,
        useTelegram: globalPref.channel_telegram && follow.channel_telegram,
        usePush: globalPref.channel_push && follow.channel_push,
      });
    }
  }

  // ═════════════════════════════════════
  // 3. ENVOI
  // ═════════════════════════════════════
  // V3.5 (10/05/2026) : DM Telegram supprimés. Canal public conservé.
  // V3.6 (11/05/2026) : push multi-device via push_subscriptions.
  for (const [, n] of toNotify) {
    // Email via Brevo
    if (n.useEmail && n.email) {
      await sendTipsterNewPickEmail(n.email, "fr", {
        pseudo: tipster.pseudo,
        matchDate: matchDateStr,
        sport: pick.sport,
        bookmaker: pick.bookmaker || "Non précisé",
      });
    }

    // Push multi-device
    if (n.usePush) {
      await sendPushToUser(n.userId, {
        title: `🎯 Nouveau prono de ${tipster.pseudo}`,
        body: `${pick.sport} · ${matchDateStr}`,
        url: "/fr/pronos-abonnes/en-cours",
      });
    }
  }
}