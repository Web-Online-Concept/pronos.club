// src/app/[locale]/(public)/videos/VideoGrid.tsx
"use client";

import { useState } from "react";
import VideoModal from "./VideoModal";

interface Video {
  id: string;
  video_id: string;
  title: string;
  thumbnail_url: string;
  published_at: string;
  youtube_channels: {
    name: string;
    logo_url: string | null;
    category: string;
  };
}

interface Props {
  videos: Video[];
  locale: string;
}

export default function VideoGrid({ videos, locale }: Props) {
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  const dateFmt = locale === "es" ? "es-ES" : locale === "en" ? "en-US" : "fr-FR";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(dateFmt, { day: "numeric", month: "short", year: "numeric" });

  // Temps relatif
  const timeAgo = (d: string) => {
    const now = Date.now();
    const diff = now - new Date(d).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return locale === "fr" ? "À l'instant" : locale === "es" ? "Ahora" : "Just now";
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}${locale === "fr" ? "j" : locale === "es" ? "d" : "d"}`;
    return fmt(d);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((video) => (
          <button
            key={video.id}
            onClick={() => setActiveVideo(video)}
            className="group overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition hover:shadow-md"
          >
            {/* Thumbnail with play overlay */}
            <div className="relative aspect-video overflow-hidden bg-neutral-100">
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-110">
                  <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="text-sm font-semibold leading-snug text-neutral-900 line-clamp-2 group-hover:text-emerald-600 transition">
                {video.title}
              </h3>
              <div className="mt-2 flex items-center gap-2">
                {video.youtube_channels.logo_url ? (
                  <img
                    src={video.youtube_channels.logo_url}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[8px] font-bold text-neutral-500">
                    {video.youtube_channels.name.charAt(0)}
                  </div>
                )}
                <span className="text-xs text-neutral-500 truncate">{video.youtube_channels.name}</span>
                <span className="text-xs text-neutral-400">·</span>
                <span className="text-xs text-neutral-400">{timeAgo(video.published_at)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modal embed */}
      {activeVideo && (
        <VideoModal
          videoId={activeVideo.video_id}
          title={activeVideo.title}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </>
  );
}