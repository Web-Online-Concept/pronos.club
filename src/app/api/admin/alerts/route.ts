import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("admin_alert_prefs")
    .select("*, user:users(email, display_name)")
    .order("created_at");

  return NextResponse.json(data ?? []);
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { user_id, alert_new_signup, alert_new_premium, alert_cancellation } = body;

  if (!user_id) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("admin_alert_prefs")
    .upsert(
      {
        user_id,
        alert_new_signup,
        alert_new_premium,
        alert_cancellation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}