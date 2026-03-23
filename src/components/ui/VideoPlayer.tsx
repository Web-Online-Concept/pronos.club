"use client";

import { useState, useRef } from "react";

interface VideoPlayerProps {
  src: string;
  thumbnail: string;
  title: string;
}

export default function VideoPlayer({ src, thumbnail, title }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function handlePlay() {
    setPlaying(true);
    // Wait for video to render, then play
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  }

  function handleEnded() {
    setPlaying(false);
  }

  return (
    <div className="relative aspect-video bg-black overflow-hidden">
      {!playing ? (
        <button
          onClick={handlePlay}
          className="group relative h-full w-full cursor-pointer"
          aria-label={`Lire la vidéo : ${title}`}
        >
          {/* Thumbnail */}
          <img
            src={thumbnail}
            alt={title}
            className="h-full w-full object-cover transition group-hover:brightness-75"
          />

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 shadow-lg shadow-black/30 transition group-hover:bg-black/80 group-hover:scale-110">
              <svg className="ml-1 h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Title overlay bottom */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
            <p className="text-sm font-bold text-white">{title}</p>
          </div>
        </button>
      ) : (
        <video
          ref={videoRef}
          src={src}
          controls
          onEnded={handleEnded}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}