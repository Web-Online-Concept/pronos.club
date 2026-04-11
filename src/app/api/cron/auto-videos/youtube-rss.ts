// src/app/api/cron/auto-videos/youtube-rss.ts
// Fetch YouTube RSS feeds + auto-detect logo from channel page

export interface YouTubeVideo {
  videoId: string;
  channelId: string;
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
}

const RSS_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractVideos(xml: string, channelId: string): YouTubeVideo[] {
  const videos: YouTubeVideo[] = [];
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
        title: decodeEntities(titleMatch[1].trim()),
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

/**
 * Fetch le logo d'une chaîne YouTube depuis sa page publique.
 * Cherche l'og:image ou l'avatar dans le HTML.
 */
export async function fetchChannelLogo(channelId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PRONOS.CLUB/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Chercher og:image (c'est le logo/banner de la chaîne)
    const ogMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
    if (ogMatch) return ogMatch[1];

    // Fallback: chercher l'avatar dans le JSON embarqué
    const avatarMatch = html.match(/"avatar":\s*\{\s*"thumbnails":\s*\[\s*\{\s*"url":\s*"([^"]+)"/);
    if (avatarMatch) return avatarMatch[1];

    return null;
  } catch {
    return null;
  }
}