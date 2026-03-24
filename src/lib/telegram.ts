const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = process.env.TELEGRAM_GROUP_ID!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function createInviteLink(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${TELEGRAM_API}/createChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        member_limit: 1, // Single use
        expire_date: Math.floor(Date.now() / 1000) + 60 * 60 * 48, // 48h
        name: `premium-${userId.slice(0, 8)}`,
      }),
    });

    const data = await res.json();
    if (data.ok && data.result?.invite_link) {
      return data.result.invite_link;
    }
    console.error("Telegram createInviteLink error:", data);
    return null;
  } catch (err) {
    console.error("Telegram createInviteLink failed:", err);
    return null;
  }
}

export async function kickMember(telegramUserId: number): Promise<boolean> {
  try {
    // Ban the user (removes from group)
    const banRes = await fetch(`${TELEGRAM_API}/banChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        user_id: telegramUserId,
      }),
    });

    const banData = await banRes.json();

    if (!banData.ok) {
      console.error("Telegram banChatMember error:", banData);
      return false;
    }

    // Unban immediately so they can rejoin later if they resubscribe
    await fetch(`${TELEGRAM_API}/unbanChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        user_id: telegramUserId,
        only_if_banned: true,
      }),
    });

    return true;
  } catch (err) {
    console.error("Telegram kickMember failed:", err);
    return false;
  }
}

export async function revokeInviteLink(inviteLink: string): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/revokeChatInviteLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: GROUP_ID,
        invite_link: inviteLink,
      }),
    });

    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}