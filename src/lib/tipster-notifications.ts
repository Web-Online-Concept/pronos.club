// src/lib/tipster-notifications.ts
// Envoie les notifications aux followers quand un tipster publie un pick
// 3 canaux : Email (Brevo via emails.ts) + Telegram (bot + canal public) + Push (web-push sur users.push_subscription)

import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { sendTipsterNewPickEmail } from "@/lib/emails";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configuration web-push (mêmes env vars que /api/notifications/send)
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

// ── Helper Push ──
// V3.5 Lot 14 : lit users.push_subscription (JSON) et notify_abonnes_push pour
// l'opt-in catégorie "Pronos Abonnés". Si l'utilisateur a désactivé les push
// abonnés mais gardé les push tipster, on respecte cette préférence.
async function sendPushToUser(userId: string, payload: any) {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("push_subscription, notify_abonnes_push")
      .eq("id", userId)
      .single();

    if (!user || !user.notify_abonnes_push || !user.push_subscription) return;

    try {
      await webpush.sendNotification(
        user.push_subscription as webpush.PushSubscription,
        JSON.stringify(payload)
      );
    } catch (err: any) {
      const statusCode = err?.statusCode || 0;
      // Subscription morte : on nettoie tous les toggles push
      if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
        await supabaseAdmin
          .from("users")
          .update({
            push_subscription: null,
            notify_push: false,
            notify_tipster_push: false,
            notify_abonnes_push: false,
          })
          .eq("id", userId);
      }
    }
  } catch (err) {
    console.error("[push] error:", err);
  }
}

// ── Main : envoie les notifs pour un nouveau pick ──
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
  for (const [, n] of toNotify) {
    // Email via Brevo (emails.ts)
    if (n.useEmail && n.email) {
      await sendTipsterNewPickEmail(n.email, "fr", {
        pseudo: tipster.pseudo,
        matchDate: matchDateStr,
        sport: pick.sport,
        bookmaker: pick.bookmaker || "Non précisé",
      });
    }

    // Telegram DM
    if (n.useTelegram && n.telegramChatId) {
      const tgMsg =
        `🎯 <b>Nouveau prono de ${tipster.pseudo}</b>\n\n` +
        `📅 Match : ${matchDateStr}\n` +
        `🏅 Sport : ${pick.sport}\n` +
        (pick.bookmaker ? `🏦 Bookmaker : ${pick.bookmaker}\n` : "") +
        `\n👉 <a href="${publicUrl}">Voir sur PRONOS.CLUB</a>`;
      await sendTelegramMessage(n.telegramChatId, tgMsg);
    }

    // Push PWA (users.push_subscription JSON + notify_abonnes_push opt-in catégorie)
    if (n.usePush) {
      await sendPushToUser(n.userId, {
        title: `🎯 Nouveau prono de ${tipster.pseudo}`,
        body: `${pick.sport} · ${matchDateStr}`,
        url: "/fr/pronos-abonnes/en-cours",
      });
    }
  }
}