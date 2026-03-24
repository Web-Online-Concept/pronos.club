import { requireAdmin } from "@/lib/auth";
import { onPremiumActivated, onPremiumRevoked } from "@/lib/telegram-hooks";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const userId = searchParams.get("user_id");

  if (!action || !userId) {
    return NextResponse.json({ error: "Missing action or user_id" }, { status: 400 });
  }

  if (action === "invite") {
    await onPremiumActivated(userId);
    return NextResponse.json({ success: true, action: "invite", userId });
  }

  if (action === "kick") {
    await onPremiumRevoked(userId);
    return NextResponse.json({ success: true, action: "kick", userId });
  }

  return NextResponse.json({ error: "Invalid action. Use 'invite' or 'kick'" }, { status: 400 });
}