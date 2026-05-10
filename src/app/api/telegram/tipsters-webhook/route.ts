// src/app/api/telegram/tipsters-webhook/route.ts
//
// V3.5 (10/05/2026) — DÉSACTIVÉ.
//
// Décision : suppression complète des notifications par DM Telegram.
// Le bot @pronos_abonnes_club_bot ne traite plus aucune commande.
// Les users qui font /start ou /stop reçoivent un message poli les renvoyant vers le site.
//
// Pour réactiver complètement : restaurer la version git précédente de ce fichier.
//
// Côté Telegram, il est aussi recommandé de delete le webhook côté Telegram via :
//   curl https://api.telegram.org/bot<TIPSTERS_TELEGRAM_BOT_TOKEN>/deleteWebhook
// Cela empêche Telegram d'envoyer des requêtes inutiles à ce endpoint.

import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = process.env.TIPSTERS_TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId: number, text: string) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("[telegram-webhook DEPRECATED] sendMessage error:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat?.id;
    const text: string = message.text || "";

    if (!chatId) return NextResponse.json({ ok: true });

    // Log pour suivre si des users essaient encore d'utiliser le bot
    console.log(
      `[telegram-webhook DEPRECATED] Reçu commande "${text.substring(0, 30)}" de chat_id=${chatId} — service désactivé`
    );

    // Réponse polie unique pour TOUTES les commandes (/start, /stop, autres)
    await sendMessage(
      chatId,
      `ℹ️ <b>Notifications par message privé désactivées</b>\n\n` +
      `Ce bot n'envoie plus de pronostics en message privé.\n\n` +
      `Pour suivre nos pronostics :\n` +
      `• 🌐 Site : <a href="https://pronos.club">pronos.club</a>\n` +
      `• 📢 Canal Telegram : <a href="https://t.me/pronos_club_abonnes_notifs">@pronos_club_abonnes_notifs</a>\n\n` +
      `Tu peux aussi recevoir les notifs par email ou push sur le site (espace personnel).`
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram-webhook DEPRECATED] error:", err);
    return NextResponse.json({ ok: true });
  }
}