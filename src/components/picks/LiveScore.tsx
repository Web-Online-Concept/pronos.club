"use client";

import { useState, useEffect, useRef } from "react";

interface SetScore {
  home: number;
  away: number;
  homeTiebreak?: number;
  awayTiebreak?: number;
}

interface LiveScoreData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchStatus: string;
  minute?: string;
  found?: boolean;
  isTennis?: boolean;
  sets?: SetScore[];
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

  // Tennis gets its own display
  if (score.isTennis && score.sets && score.sets.length > 0) {
    return (
      <TennisScore
        score={score}
        isPlaying={isPlaying}
        isFinal={isFinal}
        isPostponed={isPostponed}
      />
    );
  }

  // Football / other sports — original display
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

// ═══════════════════════════════════════════════
// TENNIS DISPLAY
// Format: "Navone  6/4  3/6  6/4  Van de Zandschulp"
// ═══════════════════════════════════════════════

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length <= 1) return fullName;
  return parts.slice(1).join(" ");
}

function TennisScore({
  score,
  isPlaying,
  isFinal,
  isPostponed,
}: {
  score: LiveScoreData;
  isPlaying: boolean;
  isFinal: boolean;
  isPostponed: boolean;
}) {
  const sets = score.sets || [];
  const homeName = getLastName(score.homeTeam);
  const awayName = getLastName(score.awayTeam);

  const homeWon = isFinal && score.homeScore > score.awayScore;
  const awayWon = isFinal && score.awayScore > score.homeScore;

  return (
    <div className={`mt-2 rounded-lg px-3 py-2 ${
      isPlaying
        ? "bg-red-500/10 border border-red-500/20"
        : isFinal
        ? "bg-white/5 border border-white/10"
        : "bg-amber-500/10 border border-amber-500/20"
    }`}>
      {/* Status line */}
      <div className="flex items-center justify-center gap-2 mb-1.5">
        {isPlaying && (
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          isPlaying ? "text-red-400"
          : isFinal ? "text-white/40"
          : "text-amber-400"
        }`}>
          {isPlaying ? "LIVE" : isFinal ? "TERMINÉ" : isPostponed ? "REPORTÉ" : ""}
          {isPlaying && score.minute ? ` · ${score.minute}` : ""}
        </span>
      </div>

      {/* Tennis score line: Name  6/4  3/6  7/5  Name */}
      <div className="flex items-center justify-center gap-2">
        {/* Home player name */}
        <span className={`text-xs font-bold truncate max-w-[90px] text-right ${
          homeWon ? "text-green-400" : isPlaying ? "text-white" : "text-white/60"
        }`}>
          {homeName}
        </span>

        {/* Set scores */}
        <div className="flex items-center gap-1">
          {sets.map((set, i) => {
            const isHomeSetWin = set.home > set.away;
            return (
              <span
                key={i}
                className={`font-mono text-sm font-bold px-1 ${
                  isPlaying
                    ? "text-white"
                    : isHomeSetWin
                    ? "text-white/70"
                    : "text-white/40"
                }`}
              >
                {set.home}/{set.away}
                {(set.homeTiebreak !== undefined || set.awayTiebreak !== undefined) && (
                  <sup className="text-[8px] text-white/30 ml-px">
                    {Math.min(set.homeTiebreak ?? 99, set.awayTiebreak ?? 99)}
                  </sup>
                )}
              </span>
            );
          })}
        </div>

        {/* Away player name */}
        <span className={`text-xs font-bold truncate max-w-[90px] text-left ${
          awayWon ? "text-green-400" : isPlaying ? "text-white" : "text-white/60"
        }`}>
          {awayName}
        </span>
      </div>
    </div>
  );
}

function isRecentEvent(eventDate: string): boolean {
  const now = new Date();
  const event = new Date(eventDate);
  const diffMs = now.getTime() - event.getTime();

  if (diffMs < -6 * 60 * 60 * 1000) return false;
  if (diffMs > 12 * 60 * 60 * 1000) return false;

  return true;
}