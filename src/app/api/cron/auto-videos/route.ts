// src/app/api/cron/auto-videos/route.ts
// CRON Vercel — Fetch vidéos YouTube toutes les 2h
// Flow : get active channels → fetch RSS → déduplique → INSERT youtube_videos

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchYouTubeRSS } from "./youtube-rss";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const maxDuration = 60;

function verifyCron(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === process.env.CRON_SECRET) return true;
  return false;
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results = { channels: 0, fetched: 0, new: 0, skipped: 0, errors: 0 };

  try {
    // 1. Get active channels
    const { data: channels } = await supabaseAdmin
      .from("youtube_channels")
      .select("channel_id")
      .eq("is_active", true);

    if (!channels || channels.length === 0) {
      return NextResponse.json({ ...results, message: "No active channels" });
    }

    results.channels = channels.length;

    // 2. Fetch RSS for all channels
    const videos = await fetchYouTubeRSS(channels);
    results.fetched = videos.length;

    if (videos.length === 0) {
      return NextResponse.json({ ...results, message: "No videos fetched" });
    }

    // 3. Déduplique — vérifier quels video_id existent déjà
    const videoIds = videos.map((v) => v.videoId);
    const { data: existing } = await supabaseAdmin
      .from("youtube_videos")
      .select("video_id")
      .in("video_id", videoIds);

    const existingIds = new Set((existing || []).map((e) => e.video_id));

    // 4. INSERT les nouvelles vidéos
    const newVideos = videos.filter((v) => !existingIds.has(v.videoId));
    results.skipped = videos.length - newVideos.length;

    if (newVideos.length > 0) {
      const rows = newVideos.map((v) => ({
        video_id: v.videoId,
        channel_id: v.channelId,
        title: v.title,
        thumbnail_url: v.thumbnailUrl,
        published_at: v.publishedAt,
      }));

      const { error } = await supabaseAdmin
        .from("youtube_videos")
        .upsert(rows, { onConflict: "video_id", ignoreDuplicates: true });

      if (error) {
        results.errors++;
        return NextResponse.json({ ...results, error: error.message, elapsed_ms: Date.now() - startTime });
      }

      results.new = newVideos.length;
    }

    return NextResponse.json({ ...results, elapsed_ms: Date.now() - startTime });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, ...results }, { status: 500 });
  }
}