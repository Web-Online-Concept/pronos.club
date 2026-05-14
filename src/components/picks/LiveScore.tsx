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
  /** Pre-loaded score from DB (picks.live_score_data or pick_legs.live_score_data) */
  savedScore?: LiveScoreData | null;
  /** For combined legs: pass event info directly instead of pick_id lookup */
  legEventName?: string;
  legEventDate?: string;
  legSportSlug?: string;
  legCompetition?: string;
  /** For combined legs: save params */
  legNumber?: number;
}

export default function LiveScore({
  pickId,
  eventDate,
  pickStatus,
  savedScore,
  legEventName,
  legEventDate,
  legSportSlug,
  legCompetition,
  legNumber,
}: LiveScoreProps) {
  const [score, setScore] = useState<LiveScoreData | null>(savedScore ?? null);
  const [loaded, setLoaded] = useState(!!savedScore);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isPending = pickStatus === "pending";
  const isResolved = ["won", "lost", "half_won", "half_lost", "void"].includes(pickStatus);
  const checkDate = legEventDate || eventDate;

  // If we have a saved score from DB, no need to fetch at all
  const hasSavedScore = !!savedScore;
  // CHANGEMENT MAI 2026 : on n'affiche le score live QUE pour les picks resolus
  // (won/lost/etc.), plus sur les "Pronos en cours" (pending). Decision Florent :
  // un score n'a de sens que sur l'historique, pas pendant la phase de pari.
  const shouldFetch = !hasSavedScore && isRecentEvent(checkDate, isResolved) && isResolved;

  const isLegMode = !!legEventName;

  useEffect(() => {
    if (hasSavedScore || !shouldFetch) {
      setLoaded(true);
      return;
    }

    fetchScore();

    // Plus d'auto-refresh : on n'affiche les scores que pour les picks RESOLUS,
    // donc un seul fetch suffit (le score ne changera plus).
    // (Code conserve au cas ou on voudrait reactiver le live sur pending plus tard)
    // if (isPending) {
    //   intervalRef.current = setInterval(fetchScore, 60000);
    // }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pickId, legEventName, shouldFetch, hasSavedScore]);

  useEffect(() => {
    if (score?.matchStatus === "final" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [score?.matchStatus]);

  async function fetchScore() {
    try {
      let url: string;
      if (isLegMode) {
        const params = new URLSearchParams({
          event: legEventName!,
          date: legEventDate || eventDate,
          sport: legSportSlug || "football",
        });
        if (legCompetition) params.set("competition", legCompetition);
        // Pass save params so the API auto-saves when match is final
        if (isResolved && legNumber !== undefined) {
          params.set("save_pick_id", pickId);
          params.set("save_leg", String(legNumber));
        }
        url = `/api/live-scores?${params.toString()}`;
      } else {
        url = `/api/live-scores?pick_id=${pickId}`;
      }

      const res = await fetch(url);
      if (!res.ok) { setLoaded(true); return; }
      const data = await res.json();
      // data.hidden=true : flag admin "cacher score" → on n'affiche rien
      // data.found=false : ESPN n'a pas trouve le match → on n'affiche rien
      // !data.homeTeam : reponse malformee → on n'affiche rien
      if (data.found === false || data.hidden === true || !data.homeTeam) {
        setScore(null);
      } else {
        setScore(data);
      }
    } catch {
      // Silent
    }
    setLoaded(true);
  }

  if (!loaded || !score) return null;
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

  // Football / other sports
  // Extract short team names (last word or short version)
  const homeShort = getShortTeamName(score.homeTeam);
  const awayShort = getShortTeamName(score.awayTeam);
  const homeWins = isFinal && score.homeScore > score.awayScore;
  const awayWins = isFinal && score.awayScore > score.homeScore;

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
          {isLive ? "LIVE" : isHalftime ? "MI-TEMPS" : isExtraTime ? "PROL." : isPenalties ? "TIRS AU BUT" : isFinal ? "TERMINÉ" : isPostponed ? "REPORTÉ" : ""}
          {isPlaying && score.minute ? ` · ${score.minute}` : ""}
        </span>
      </div>

      {/* Score line: Team1  4 - 3  Team2 */}
      <div className="flex items-center justify-center gap-2">
        <span className={`text-xs font-bold truncate max-w-[100px] text-right ${
          homeWins ? "text-green-400" : isPlaying ? "text-white" : "text-white/60"
        }`}>
          {homeShort}
        </span>

        <span className={`font-mono text-lg font-extrabold ${
          isPlaying ? "text-white" : "text-white/60"
        }`}>
          {score.homeScore} - {score.awayScore}
        </span>

        <span className={`text-xs font-bold truncate max-w-[100px] text-left ${
          awayWins ? "text-green-400" : isPlaying ? "text-white" : "text-white/60"
        }`}>
          {awayShort}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TENNIS DISPLAY
// ═══════════════════════════════════════════════

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length <= 1) return fullName;
  return parts.slice(1).join(" ");
}

function getShortTeamName(fullName: string): string {
  // For football teams, ESPN returns full names like "PSV Eindhoven", "FC Utrecht"
  // We keep it as-is but truncate via CSS max-w
  // Remove common prefixes/suffixes that add noise
  return fullName
    .replace(/^FC\s+/i, "")
    .replace(/\s+FC$/i, "")
    .trim() || fullName;
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

      <div className="flex items-center justify-center gap-2">
        <span className={`text-xs font-bold truncate max-w-[90px] text-right ${
          homeWon ? "text-green-400" : isPlaying ? "text-white" : "text-white/60"
        }`}>
          {homeName}
        </span>

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

        <span className={`text-xs font-bold truncate max-w-[90px] text-left ${
          awayWon ? "text-green-400" : isPlaying ? "text-white" : "text-white/60"
        }`}>
          {awayName}
        </span>
      </div>
    </div>
  );
}

function isRecentEvent(eventDate: string, isResolved = false): boolean {
  const now = new Date();
  const event = new Date(eventDate);
  const diffMs = now.getTime() - event.getTime();

  if (diffMs < -6 * 60 * 60 * 1000) return false;

  // Resolved picks: 48h window (score should be saved by then)
  // Pending picks: 12h window
  const maxAge = isResolved ? 48 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  if (diffMs > maxAge) return false;

  return true;
}