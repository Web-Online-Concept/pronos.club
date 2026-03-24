import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await request.json();

  // New member joined the group
  if (update.message?.new_chat_members) {
    const chatId = update.message.chat.id.toString();
    const expectedGroupId = process.env.TELEGRAM_GROUP_ID;

    if (chatId !== expectedGroupId) {
      return NextResponse.json({ ok: true });
    }

    for (const member of update.message.new_chat_members) {
      if (member.is_bot) continue;

      const telegramUserId = member.id;
      const telegramUsername = member.username ?? null;

      // Find user by their invite link
      // The invite link was stored when we generated it
      // We match by checking users who have a telegram_invite_link but no telegram_user_id yet
      const { data: pendingUsers } = await supabaseAdmin
        .from("users")
        .select("id, telegram_invite_link")
        .is("telegram_user_id", null)
        .not("telegram_invite_link", "is", null)
        .eq("subscription_status", "active");

      if (pendingUsers && pendingUsers.length > 0) {
        // Take the most recent pending user (FIFO)
        // In practice, invites are unique so only one should be pending at a time
        const userToLink = pendingUsers[0];

        await supabaseAdmin
          .from("users")
          .update({
            telegram_user_id: telegramUserId,
          })
          .eq("id", userToLink.id);

        console.log(`Linked Telegram ${telegramUserId} (${telegramUsername}) to user ${userToLink.id}`);
      }
    }
  }

  // Member left the group (optional tracking)
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