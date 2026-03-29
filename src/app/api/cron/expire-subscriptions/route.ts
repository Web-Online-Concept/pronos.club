import { supabaseAdmin } from "@/lib/supabase/admin";
import { onPremiumRevoked } from "@/lib/telegram-hooks";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-vercel-cron");

  if (cronHeader !== "1" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Find all active users whose subscription_end has passed
  const { data: expiredUsers, error: fetchError } = await supabaseAdmin
    .from("users")
    .select("id, email, subscription_end")
    .eq("subscription_status", "active")
    .not("subscription_end", "is", null)
    .lt("subscription_end", now);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!expiredUsers || expiredUsers.length === 0) {
    return NextResponse.json({ expired: 0, message: "No expired subscriptions" });
  }

  let kicked = 0;

  for (const user of expiredUsers) {
    // Reset to free
    await supabaseAdmin
      .from("users")
      .update({ subscription_status: "free", subscription_end: null })
      .eq("id", user.id);

    // Kick from Telegram group
    try {
      await onPremiumRevoked(user.id);
      kicked++;
    } catch {
      // Silent fail — user might not be in Telegram
    }
  }

  return NextResponse.json({
    expired: expiredUsers.length,
    kicked,
    users: expiredUsers.map((u) => u.email),
    message: `${expiredUsers.length} subscription(s) expired, ${kicked} kicked from Telegram`,
  });
}