import { supabaseAdmin } from "@/lib/supabase/admin";
import { createInviteLink, kickMember, revokeInviteLink } from "@/lib/telegram";
import { sendWelcomePremiumEmail } from "@/lib/emails";

/**
 * Called when a user becomes premium — generates invite link and sends welcome premium email
 */
export async function onPremiumActivated(userId: string) {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("email, pseudo, display_name, telegram_user_id")
      .eq("id", userId)
      .single();

    if (!user || !user.email) return;

    // Already in group
    if (user.telegram_user_id) return;

    // Generate invite link
    const inviteLink = await createInviteLink(userId);

    // Store it
    if (inviteLink) {
      await supabaseAdmin
        .from("users")
        .update({ telegram_invite_link: inviteLink })
        .eq("id", userId);
    }

    const displayName = user.pseudo || user.display_name || user.email.split("@")[0];

    // Send welcome premium email with Telegram link
    await sendWelcomePremiumEmail(user.email, displayName, inviteLink);
  } catch (err) {
    console.error("onPremiumActivated error:", err);
  }
}

/**
 * Called when a user loses premium — kicks from Telegram group
 */
export async function onPremiumRevoked(userId: string) {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("telegram_user_id, telegram_invite_link")
      .eq("id", userId)
      .single();

    if (!user) return;

    // Kick from group if they joined
    if (user.telegram_user_id) {
      await kickMember(user.telegram_user_id);
    }

    // Revoke invite link if it exists
    if (user.telegram_invite_link) {
      await revokeInviteLink(user.telegram_invite_link);
    }

    // Clear telegram data
    await supabaseAdmin
      .from("users")
      .update({ telegram_user_id: null, telegram_invite_link: null })
      .eq("id", userId);
  } catch (err) {
    console.error("onPremiumRevoked error:", err);
  }
}