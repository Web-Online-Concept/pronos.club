// src/app/api/videos/route.ts
// API publique pour la page Vidéos — GET avec pagination et filtres

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channel");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "24");
  const offset = (page - 1) * limit;

  // Build query with channel join
  let query = supabaseAdmin
    .from("youtube_videos")
    .select("*, youtube_channels!inner(name, logo_url, category, is_active)", { count: "exact" })
    .eq("youtube_channels.is_active", true)
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (channelId) {
    query = query.eq("channel_id", channelId);
  }

  if (category) {
    query = query.eq("youtube_channels.category", category);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    videos: data || [],
    total: count || 0,
    page,
    limit,
  });
}