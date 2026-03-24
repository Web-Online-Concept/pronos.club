import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createInviteLink } from "@/lib/telegram";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check user is premium
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("subscription_status, telegram_user_id, telegram_invite_link")
    .eq("id", user.id)
    .single();

  if (!profile || profile.subscription_status !== "active") {
    return NextResponse.json({ error: "Premium subscription required" }, { status: 403 });
  }

  // Already in the group
  if (profile.telegram_user_id) {
    return NextResponse.json({ error: "Already in the Telegram group" }, { status: 400 });
  }

  // Already has a pending invite
  if (profile.telegram_invite_link) {
    return NextResponse.json({ invite_link: profile.telegram_invite_link });
  }

  // Generate new invite
  const inviteLink = await createInviteLink(user.id);

  if (!inviteLink) {
    return NextResponse.json({ error: "Failed to generate invite link" }, { status: 500 });
  }

  // Store invite link
  await supabaseAdmin
    .from("users")
    .update({ telegram_invite_link: inviteLink })
    .eq("id", user.id);

  return NextResponse.json({ invite_link: inviteLink });
}