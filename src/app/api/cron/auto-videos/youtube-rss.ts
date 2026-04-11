// src/app/api/cron/auto-videos/youtube-rss.ts
// Fetch YouTube RSS feeds pour toutes les chaînes actives

export interface YouTubeVideo {
  videoId: string;
  channelId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
}

const RSS_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";

function extractVideos(xml: string, channelId: string): YouTubeVideo[] {
  const videos: YouTubeVideo[] = [];

  // Parse <entry> blocks
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);

    if (videoIdMatch && titleMatch) {
      const videoId = videoIdMatch[1].trim();
      videos.push({
        videoId,
        channelId,
        title: titleMatch[1].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        publishedAt: publishedMatch ? publishedMatch[1].trim() : new Date().toISOString(),
      });
    }
  }

  return videos;
}

export async function fetchYouTubeRSS(channels: { channel_id: string }[]): Promise<YouTubeVideo[]> {
  const allVideos: YouTubeVideo[] = [];

  for (const channel of channels) {
    try {
      const res = await fetch(`${RSS_BASE}${channel.channel_id}`, {
        headers: { "User-Agent": "PRONOS.CLUB/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`[auto-videos] RSS error for ${channel.channel_id}: ${res.status}`);
        continue;
      }

      const xml = await res.text();
      const videos = extractVideos(xml, channel.channel_id);
      allVideos.push(...videos);
    } catch (err) {
      console.error(`[auto-videos] RSS fetch error for ${channel.channel_id}:`, err);
    }
  }

  return allVideos;
}