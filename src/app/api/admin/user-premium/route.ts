import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { onPremiumActivated, onPremiumRevoked } from "@/lib/telegram-hooks";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user_id, email, subscription_status, subscription_end } = await request.json();

  // Find user by id or email
  let targetId = user_id;
  if (!targetId && email) {
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();
    if (!userRow) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    targetId = userRow.id;
  }

  if (!targetId) {
    return NextResponse.json({ error: "user_id or email required" }, { status: 400 });
  }

  // Get current status before update
  const { data: currentUser } = await supabaseAdmin
    .from("users")
    .select("subscription_status")
    .eq("id", targetId)
    .single();

  const wasActive = currentUser?.subscription_status === "active";
  const newStatus = subscription_status ?? "active";
  const willBeActive = newStatus === "active";

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      subscription_status: newStatus,
      subscription_end: subscription_end ?? new Date(Date.now() + 365 * 86400000).toISOString(),
    })
    .eq("id", targetId)
    .select("id, email, pseudo, subscription_status, subscription_end")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Telegram: invite if becoming premium, kick if losing premium
  if (!wasActive && willBeActive) {
    await onPremiumActivated(targetId).catch((err) => console.error("[TELEGRAM] error:", err));
  } else if (wasActive && !willBeActive) {
    await onPremiumRevoked(targetId).catch((err) => console.error("[TELEGRAM] error:", err));
  }

  return NextResponse.json(data);
}