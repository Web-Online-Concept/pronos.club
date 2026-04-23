// src/lib/tipster-notifications.ts
// Envoie les notifications aux followers quand un tipster publie un pick
// 3 canaux : Email (Resend) + Telegram (bot + canal public) + Push (web-push)

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import webpush from "web-push";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Configurer web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_SUBJECT || "contact@pronos.club"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const TELEGRAM_BOT_TOKEN = process.env.TIPSTERS_TELEGRAM_BOT_TOKEN;
const TELEGRAM_PUBLIC_CHANNEL = process.env.TIPSTERS_TELEGRAM_CHANNEL; // ex: @pronos_abonnes_club

type Pick = {
  id: string;
  user_id: string;
  sport: string;
  odds: number;
  pick_type: string;
  match_date: string;
};

type Tipster = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
};

// ── Helpers ──
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

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: "PRONOS.CLUB <noreply@pronos.club>",
      to,
      replyTo: "contact@pronos.club",
      subject,
      html,
    });
  } catch (err) {
    console.error("[email] error:", err);
  }
}

async function sendPush(userId: string, payload: any) {
  try {
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        // 410 = subscription dead, on supprime
        if (err?.statusCode === 410 || err?.statusCode === 404 || err?.statusCode === 403) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
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
  });

  const publicUrl = `https://pronos.club/fr/pronos-abonnes/en-cours`;
  const profileUrl = `https://pronos.club/fr/pronos-abonnes/${encodeURIComponent(tipster.pseudo)}`;

  // ═════════════════════════════════════
  // 1. CANAL PUBLIC TELEGRAM (si config\u00e9)
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
  // R\u00e9cup\u00e9rer tous les abonn\u00e9s \u00e0 notifier :
  // - Mode "all" : tous les users premium avec prefs en "all"
  // - Mode "selected" : les followers de ce tipster spe\u0301cifiquement

  // 2a. Users en mode "all"
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

  // 2b. Users en mode "selected" qui suivent ce tipster
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

  // Construire la liste finale (de\u0301doublonner)
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
    if (u.id === tipster.id) continue; // ne pas se notifier soi-m\u00eame
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

  // Mode "selected" : les followers
  // On doit croiser avec leurs prefs globales (is mode "selected" et canaux globaux activ\u00e9s)
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
      if (toNotify.has(u.id)) continue; // d\u00e9j\u00e0 notifi\u00e9 via mode "all"

      const premium = u.subscription_status === "active" || u.subscription_status === "trialing";
      if (!premium) continue;

      const globalPref = prefsMap.get(u.id);
      if (!globalPref) continue; // pas en mode "selected"

      // Croiser pr\u00e9fs globales ET override par tipster
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
  // 3. ENVOI AUX ABONN\u00c9S
  // ═════════════════════════════════════
  for (const [, n] of toNotify) {
    // Email
    if (n.useEmail && n.email) {
      const emailSubject = `🎯 Nouveau prono de ${tipster.pseudo}`;
      const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#fff;color:#0a0a0a;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:24px;">
    <p style="font-size:11px;font-weight:800;letter-spacing:0.3em;text-transform:uppercase;color:#10b981;margin:0;">🎯 PRONOS ABONNÉS</p>
    <h1 style="font-size:22px;font-weight:900;margin:8px 0 0;color:#0a0a0a;">Nouveau pronostic !</h1>
  </div>

  <div style="background:linear-gradient(135deg,#0a0a0a 0%,#062e1f 100%);border-radius:16px;padding:24px;text-align:center;color:#fff;">
    <p style="font-size:13px;color:rgba(255,255,255,0.6);margin:0;">vient de poster un pronostic</p>
    <h2 style="font-size:28px;font-weight:900;margin:12px 0;color:#34d399;">${tipster.pseudo}</h2>
    <div style="display:inline-block;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);border-radius:12px;padding:12px 20px;margin-top:8px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#6ee7b7;margin:0 0 4px;">1er match</p>
      <p style="font-size:18px;font-weight:800;color:#fff;margin:0;">${matchDateStr}</p>
      <p style="font-size:11px;color:rgba(255,255,255,0.6);margin:4px 0 0;">${pick.sport}</p>
    </div>
  </div>

  <div style="text-align:center;margin-top:24px;">
    <a href="${publicUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;">🎯 Voir le pronostic</a>
  </div>

  <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:32px;">
    Tu reçois cet email car tu es abonné aux notifications Pronos Abonnés.
    <br><a href="https://pronos.club/fr/espace/notifications" style="color:#10b981;text-decoration:none;">Gérer mes préférences</a>
  </p>
</div>`;
      await sendEmail(n.email, emailSubject, emailHtml);
    }

    // Telegram DM
    if (n.useTelegram && n.telegramChatId) {
      const tgMsg =
        `🎯 <b>Nouveau prono de ${tipster.pseudo}</b>\n\n` +
        `📅 Match : ${matchDateStr}\n` +
        `🏅 Sport : ${pick.sport}\n\n` +
        `👉 <a href="${publicUrl}">Voir sur PRONOS.CLUB</a>`;
      await sendTelegramMessage(n.telegramChatId, tgMsg);
    }

    // Push
    if (n.usePush) {
      await sendPush(n.userId, {
        title: `🎯 Nouveau prono de ${tipster.pseudo}`,
        body: `${pick.sport} · ${matchDateStr}`,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: publicUrl },
      });
    }
  }
}