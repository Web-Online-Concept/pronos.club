// src/app/api/telegram/tipsters-webhook/route.ts
// Webhook pour le bot Telegram @pronos_abonnes_club_bot
// Répond aux commandes /start <token> pour lier un chat_id à un user

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      }),
    });
  } catch (err) {
    console.error("[telegram-webhook] sendMessage error:", err);
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

    // Commande /start <token> : lier ce chat_id à un user
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const token = parts[1];

      if (!token) {
        await sendMessage(
          chatId,
          `👋 Bienvenue sur <b>PRONOS.CLUB Pronos Abonnés</b> !\n\n` +
          `Pour recevoir les pronostics de tes tipsters favoris, tu dois d'abord lier ton compte.\n\n` +
          `Va sur <a href="https://pronos.club/fr/espace/notifications">Mes Notifications</a> ` +
          `et clique sur "Lier Telegram" pour obtenir ton code.`
        );
        return NextResponse.json({ ok: true });
      }

      // Vérifier le token (chercher un user qui a ce token temporaire)
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id, pseudo, tipsters_telegram_link_token, tipsters_telegram_link_expires")
        .eq("tipsters_telegram_link_token", token)
        .maybeSingle();

      if (!user) {
        await sendMessage(chatId, `❌ Code invalide. Génère un nouveau code sur PRONOS.CLUB.`);
        return NextResponse.json({ ok: true });
      }

      // Vérifier expiration (15 min)
      if (user.tipsters_telegram_link_expires) {
        const expiresAt = new Date(user.tipsters_telegram_link_expires).getTime();
        if (Date.now() > expiresAt) {
          await sendMessage(chatId, `❌ Code expiré. Génère un nouveau code sur PRONOS.CLUB.`);
          return NextResponse.json({ ok: true });
        }
      }

      // Enregistrer le chat_id
      await supabaseAdmin
        .from("users")
        .update({
          tipsters_telegram_chat_id: chatId,
          tipsters_telegram_link_token: null,
          tipsters_telegram_link_expires: null,
        })
        .eq("id", user.id);

      await sendMessage(
        chatId,
        `✅ <b>Compte lié avec succès !</b>\n\n` +
        `Salut ${user.pseudo || ""} ! Tu recevras maintenant les pronostics des tipsters selon tes préférences.\n\n` +
        `🔧 Gère tes préférences sur <a href="https://pronos.club/fr/espace/notifications">pronos.club/espace/notifications</a>`
      );

      return NextResponse.json({ ok: true });
    }

    // Commande /stop : délier le compte
    if (text.startsWith("/stop")) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("tipsters_telegram_chat_id", chatId)
        .maybeSingle();

      if (user) {
        await supabaseAdmin
          .from("users")
          .update({ tipsters_telegram_chat_id: null })
          .eq("id", user.id);
        await sendMessage(chatId, `✅ Compte délié. Tu ne recevras plus de notifications.`);
      } else {
        await sendMessage(chatId, `Aucun compte lié à ce chat.`);
      }
      return NextResponse.json({ ok: true });
    }

    // Autre commande : aide
    await sendMessage(
      chatId,
      `🤖 Commandes disponibles :\n\n` +
      `<b>/start CODE</b> - Lier ton compte PRONOS.CLUB\n` +
      `<b>/stop</b> - Délier ton compte`
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[telegram-webhook] error:", err.message);
    return NextResponse.json({ ok: true });
  }
}