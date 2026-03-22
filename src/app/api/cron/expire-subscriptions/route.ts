import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron or manual trigger)
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

  // Reset each expired user to free
  const expiredIds = expiredUsers.map((u) => u.id);

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({
      subscription_status: "free",
      subscription_end: null,
    })
    .in("id", expiredIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    expired: expiredIds.length,
    users: expiredUsers.map((u) => u.email),
    message: `${expiredIds.length} subscription(s) expired and reset to free`,
  });
}