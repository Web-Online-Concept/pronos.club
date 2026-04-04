import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const BOT_TOKEN = (process.env.TELEGRAM_PREMIUM_BOT_TOKEN || "").trim();
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await request.json();
  const expectedGroupId = process.env.TELEGRAM_GROUP_ID;

  // ═══════════════════════════════════════════════
  // CHAT JOIN REQUEST — user clicks invite link with join request enabled
  // This is the PREFERRED method: Telegram tells us exactly which invite link was used
  // ═══════════════════════════════════════════════
  if (update.chat_join_request) {
    const req = update.chat_join_request;
    const chatId = req.chat.id.toString();

    if (chatId !== expectedGroupId) {
      return NextResponse.json({ ok: true });
    }

    const telegramUserId = req.from.id;
    const inviteLink = req.invite_link?.invite_link;

    if (inviteLink) {
      // Find the user who owns this invite link
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("id, subscription_status")
        .eq("telegram_invite_link", inviteLink)
        .in("subscription_status", ["active", "trialing"])
        .single();

      if (user) {
        // Approve the join request
        await fetch(`${TELEGRAM_API}/approveChatJoinRequest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: expectedGroupId,
            user_id: telegramUserId,
          }),
        });

        // Link the Telegram user ID to the correct user
        await supabaseAdmin
          .from("users")
          .update({ telegram_user_id: telegramUserId })
          .eq("id", user.id);

        console.log(`[telegram] Approved & linked ${telegramUserId} to user ${user.id} via invite link`);
      } else {
        // No matching user or not premium — decline
        await fetch(`${TELEGRAM_API}/declineChatJoinRequest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: expectedGroupId,
            user_id: telegramUserId,
          }),
        });

        console.log(`[telegram] Declined ${telegramUserId} — no matching premium user for link ${inviteLink}`);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ═══════════════════════════════════════════════
  // NEW CHAT MEMBERS — fallback for direct joins (no join request)
  // Matches by invite link stored in DB
  // ═══════════════════════════════════════════════
  if (update.message?.new_chat_members) {
    const chatId = update.message.chat.id.toString();

    if (chatId !== expectedGroupId) {
      return NextResponse.json({ ok: true });
    }

    for (const member of update.message.new_chat_members) {
      if (member.is_bot) continue;

      const telegramUserId = member.id;
      const telegramUsername = member.username ?? null;

      // Check if this Telegram user is already linked
      const { data: existingUser } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("telegram_user_id", telegramUserId)
        .single();

      if (existingUser) {
        console.log(`[telegram] User ${telegramUserId} (${telegramUsername}) already linked to ${existingUser.id}`);
        continue;
      }

      // Find user by invite link — check who generated a link but hasn't joined yet
      const { data: pendingUsers } = await supabaseAdmin
        .from("users")
        .select("id, telegram_invite_link")
        .is("telegram_user_id", null)
        .not("telegram_invite_link", "is", null)
        .in("subscription_status", ["active", "trialing"]);

      if (pendingUsers && pendingUsers.length === 1) {
        // Only assign if there's exactly ONE pending user — avoids mismatches
        await supabaseAdmin
          .from("users")
          .update({ telegram_user_id: telegramUserId })
          .eq("id", pendingUsers[0].id);

        console.log(`[telegram] Linked ${telegramUserId} (${telegramUsername}) to user ${pendingUsers[0].id} (single pending)`);
      } else if (pendingUsers && pendingUsers.length > 1) {
        // Multiple pending users — DO NOT guess, log for manual resolution
        console.warn(`[telegram] Multiple pending users (${pendingUsers.length}) — cannot auto-link ${telegramUserId} (${telegramUsername}). Manual linking required.`);
      }
    }
  }

  // ═══════════════════════════════════════════════
  // MEMBER LEFT — clear telegram data
  // ═══════════════════════════════════════════════
  if (update.message?.left_chat_member) {
    const member = update.message.left_chat_member;
    if (!member.is_bot) {
      await supabaseAdmin
        .from("users")
        .update({ telegram_user_id: null, telegram_invite_link: null })
        .eq("telegram_user_id", member.id);
    }
  }

  return NextResponse.json({ ok: true });
}