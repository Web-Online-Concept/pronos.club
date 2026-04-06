import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
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
    .select("id, rating, content, status")
    .eq("user_id", user.id)
    .single();

  if (!data) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    rating: data.rating,
    content: data.content,
    status: data.status,
  });
}