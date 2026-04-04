"use client";

import { useState, useEffect, useRef } from "react";

interface LiveScoreData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchStatus: string;
  minute?: string;
  found?: boolean;
}

interface LiveScoreProps {
  pickId: string;
  eventDate: string;
  pickStatus: string;
}

export default function LiveScore({ pickId, eventDate, pickStatus }: LiveScoreProps) {
  const [score, setScore] = useState<LiveScoreData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isPending = pickStatus === "pending";
  const isResolved = ["won", "lost", "half_won", "half_lost", "void"].includes(pickStatus);
  const shouldFetch = isRecentEvent(eventDate) && (isPending || isResolved);

  useEffect(() => {
    if (!shouldFetch) {
      setLoaded(true);
      return;
    }

    fetchScore();

    // Poll every 60s only for pending picks (live matches)
    if (isPending) {
      intervalRef.current = setInterval(fetchScore, 60000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pickId, shouldFetch]);

  // Stop polling when match is final
  useEffect(() => {
    if (score?.matchStatus === "final" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [score?.matchStatus]);

  async function fetchScore() {
    try {
      const res = await fetch(`/api/live-scores?pick_id=${pickId}`);
      if (!res.ok) { setLoaded(true); return; }
      const data = await res.json();
      if (data.found === false || !data.homeTeam) {
        setScore(null);
      } else {
        setScore(data);
      }
    } catch {
      // Silent
    }
    setLoaded(true);
  }

  if (!shouldFetch || !loaded || !score) return null;
  if (score.matchStatus === "scheduled") return null;

  const isLive = score.matchStatus === "live";
  const isHalftime = score.matchStatus === "halftime";
  const isFinal = score.matchStatus === "final";
  const isPostponed = score.matchStatus === "postponed";
  const isExtraTime = score.matchStatus === "extra_time";
  const isPenalties = score.matchStatus === "penalties";
  const isPlaying = isLive || isHalftime || isExtraTime || isPenalties;

  return (
    <div className={`mt-2 flex items-center justify-center gap-3 rounded-lg px-3 py-2 ${
      isPlaying
        ? "bg-red-500/10 border border-red-500/20"
        : isFinal
        ? "bg-white/5 border border-white/10"
        : "bg-amber-500/10 border border-amber-500/20"
    }`}>
      {/* Live pulse */}
      {isPlaying && (
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      )}

      {/* Status */}
      <span className={`text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
        isPlaying ? "text-red-400"
        : isFinal ? "text-white/40"
        : "text-amber-400"
      }`}>
        {isLive ? "LIVE" : isHalftime ? "MI-TEMPS" : isExtraTime ? "PROL." : isPenalties ? "TIRS AU BUT" : isFinal ? "TERMINÉ" : isPostponed ? "REPORTÉ" : ""}
      </span>

      {/* Score */}
      <span className={`font-mono text-lg font-extrabold ${
        isPlaying ? "text-white" : "text-white/60"
      }`}>
        {score.homeScore} - {score.awayScore}
      </span>

      {/* Minute */}
      {isPlaying && score.minute && (
        <span className="text-[10px] font-bold text-red-400/70 flex-shrink-0">
          {score.minute}
        </span>
      )}
    </div>
  );
}

function isRecentEvent(eventDate: string): boolean {
  const now = new Date();
  const event = new Date(eventDate);
  const diffMs = now.getTime() - event.getTime();

  // Too far in the future (more than 6h before)
  if (diffMs < -6 * 60 * 60 * 1000) return false;
  // Too old (more than 12h after)
  if (diffMs > 12 * 60 * 60 * 1000) return false;

  return true;
}