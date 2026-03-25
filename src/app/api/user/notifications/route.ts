import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const updates: Record<string, boolean> = {};
  if ("notify_email" in body) updates.notify_email = body.notify_email;
  if ("notify_push" in body) updates.notify_push = body.notify_push;
  if ("notify_bilan" in body) updates.notify_bilan = body.notify_bilan;

  const { error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}