import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ exists: false });
  }

  const { data } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({ exists: !!data });
}