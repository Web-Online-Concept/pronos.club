"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

/* ── Types ────────────────────────────────── */
interface LiveMatch {
  id: string;
  homeTeam: string;
  homeAbbr: string;
  homeLogo: string;
  homeScore: string;
  awayTeam: string;
  awayAbbr: string;
  awayLogo: string;
  awayScore: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "other";
  statusText: string;
  clock: string;
  startTime: string;
}

interface LiveLeague {
  slug: string;
  name: string;
  flag?: string;
  matches: LiveMatch[];
}

interface LiveSport {
  key: string;
  name: string;
  icon: string;
  leagues: LiveLeague[];
  totalMatches: number;
  liveMatches: number;
}

interface Labels {
  live: string;
  scheduled: string;
  finished: string;
  postponed: string;
  noMatches: string;
  loading: string;
  allSports: string;
  refreshing: string;
  liveNow: string;
}

/* ── Helpers ───────────────────────────────── */
function formatTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

/* ── Sport tabs ────────────────────────────── */
const SPORT_TABS = [
  { key: "all", icon: "🏟️" },
  { key: "football", icon: "⚽" },
  { key: "tennis", icon: "🎾" },
  { key: "basketball", icon: "🏀" },
  { key: "hockey", icon: "🏒" },
  { key: "baseball", icon: "⚾" },
  { key: "football-us", icon: "🏈" },
  { key: "mma", icon: "🥊" },
  { key: "rugby", icon: "🏉" },
  { key: "cricket", icon: "🏏" },
  { key: "golf", icon: "⛳" },
];

/* ── Status badge ──────────────────────────── */
function StatusBadge({ match, labels }: { match: LiveMatch; labels: Labels }) {
  if (match.status === "live") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-[10px] font-bold uppercase text-red-400">
          {match.clock || match.statusText || labels.live}
        </span>
      </div>
    );
  }
  if (match.status === "scheduled") {
    return <span className="text-[11px] text-white/40">{formatTime(match.startTime)}</span>;
  }
  if (match.status === "finished") {
    return <span className="text-[10px] font-semibold text-white/30">{match.statusText || labels.finished}</span>;
  }
  if (match.status === "postponed") {
    return <span className="text-[10px] font-semibold text-amber-400/70">{labels.postponed}</span>;
  }
  return <span className="text-[10px] text-white/30">{match.statusText}</span>;
}

/* ── Team logo ─────────────────────────────── */
function TeamLogo({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-white/5 text-[9px] font-bold text-white/30">
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={24}
      height={24}
      className="h-6 w-6 object-contain"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

/* ── Match row ─────────────────────────────── */
function MatchRow({ match, labels }: { match: LiveMatch; labels: Labels }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isScheduled = match.status === "scheduled";

  return (
    <div
      className={`flex items-center gap-2 border-b border-white/[0.04] px-3 py-2.5 transition sm:px-4 ${
        isLive ? "bg-red-500/[0.04]" : "hover:bg-white/[0.02]"
      }`}
    >
      {/* Status column */}
      <div className="w-14 shrink-0 text-center sm:w-16">
        <StatusBadge match={match} labels={labels} />
      </div>

      {/* Teams + scores */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        {/* Home */}
        <div className="flex items-center gap-2">
          <TeamLogo src={match.homeLogo} alt={match.homeAbbr || match.homeTeam} />
          <span className={`flex-1 truncate text-xs font-semibold ${isFinished ? "text-white/50" : "text-white/90"}`}>
            {match.homeTeam}
          </span>
          <span
            className={`w-7 text-right font-mono text-sm font-extrabold ${
              isLive ? "text-white" : isFinished ? "text-white/50" : "text-white/20"
            }`}
          >
            {isScheduled ? "" : match.homeScore}
          </span>
        </div>
        {/* Away */}
        <div className="flex items-center gap-2">
          <TeamLogo src={match.awayLogo} alt={match.awayAbbr || match.awayTeam} />
          <span className={`flex-1 truncate text-xs font-semibold ${isFinished ? "text-white/50" : "text-white/90"}`}>
            {match.awayTeam}
          </span>
          <span
            className={`w-7 text-right font-mono text-sm font-extrabold ${
              isLive ? "text-white" : isFinished ? "text-white/50" : "text-white/20"
            }`}
          >
            {isScheduled ? "" : match.awayScore}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── League section ────────────────────────── */
function LeagueSection({ league, labels }: { league: LiveLeague; labels: Labels }) {
  const liveCount = league.matches.filter((m) => m.status === "live").length;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#141414]">
      {/* League header */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#1a1a1a] px-3 py-2 sm:px-4">
        {league.flag && <span className="text-sm">{league.flag}</span>}
        <span className="text-xs font-bold text-white/70">{league.name}</span>
        {liveCount > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {liveCount}
          </span>
        )}
        <span className="ml-auto text-[10px] text-white/20">{league.matches.length}</span>
      </div>
      {/* Matches */}
      <div>
        {league.matches.map((match) => (
          <MatchRow key={match.id} match={match} labels={labels} />
        ))}
      </div>
    </div>
  );
}

/* ── Date picker ───────────────────────────── */
function DatePicker({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const days: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const isSelected = (d: Date) => {
    return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
  };

  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {days.map((d, i) => (
        <button
          key={i}
          onClick={() => onChange(d)}
          className={`flex flex-col items-center rounded-lg px-2 py-1.5 text-center transition sm:px-3 sm:py-2 ${
            isSelected(d)
              ? "bg-emerald-600 text-white"
              : isToday(d)
              ? "bg-white/10 text-emerald-400"
              : "text-white/40 hover:bg-white/5 hover:text-white/60"
          }`}
        >
          <span className="text-[9px] font-semibold uppercase sm:text-[10px]">{dayNames[d.getDay()]}</span>
          <span className="text-sm font-bold sm:text-base">{d.getDate()}</span>
          <span className="text-[8px] sm:text-[9px]">{String(d.getMonth() + 1).padStart(2, "0")}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────── */
export default function LivescoreClient({ labels }: { labels: Labels }) {
  const [sports, setSports] = useState<LiveSport[]>([]);
  const [activeSport, setActiveSport] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (showLoader = false) => {
      if (showLoader) setLoading(true);
      else setRefreshing(true);

      try {
        const dateStr = formatDate(selectedDate);
        const sportParam = activeSport === "all" ? "all" : activeSport;
        const res = await fetch(`/api/livescore?sport=${sportParam}&date=${dateStr}`);
        if (res.ok) {
          const data = await res.json();
          setSports(data.sports ?? []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeSport, selectedDate]
  );

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchData(true);
    // Refresh every 30s
    intervalRef.current = setInterval(() => fetchData(false), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const totalLive = sports.reduce((sum, s) => sum + s.liveMatches, 0);
  const totalMatches = sports.reduce((sum, s) => sum + s.totalMatches, 0);

  return (
    <div>
      {/* Date picker */}
      <div className="mb-5">
        <DatePicker date={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Sport tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap sm:justify-center sm:gap-1.5">
        {SPORT_TABS.map((tab) => {
          const sportData = sports.find((s) => s.key === tab.key);
          const isActive = activeSport === tab.key;
          const liveCount = tab.key === "all" ? totalLive : (sportData?.liveMatches ?? 0);
          const matchCount = tab.key === "all" ? totalMatches : (sportData?.totalMatches ?? 0);

          return (
            <button
              key={tab.key}
              onClick={() => setActiveSport(tab.key)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 ${
                isActive
                  ? "bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.key === "all" ? labels.allSports : tab.key.replace("-us", " US").replace(/^\w/, (c) => c.toUpperCase())}</span>
              {matchCount > 0 && (
                <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-white/30"}`}>
                  {matchCount}
                </span>
              )}
              {liveCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                  {liveCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Live banner */}
      {totalLive > 0 && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          {totalLive} {labels.liveNow}
          {refreshing && <span className="ml-2 text-[10px] text-white/30">⟳ {labels.refreshing}</span>}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-3 text-sm text-white/40">{labels.loading}</p>
        </div>
      )}

      {/* Content */}
      {!loading && sports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <span className="text-4xl">🏟️</span>
          <p className="mt-3 text-sm text-white/40">{labels.noMatches}</p>
        </div>
      )}

      {!loading &&
        sports.map((sport) => (
          <div key={sport.key} className="mb-6">
            {/* Sport header (only show when viewing "all") */}
            {activeSport === "all" && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">{sport.icon}</span>
                <h2 className="text-sm font-bold text-white/80">{sport.name}</h2>
                <span className="text-[10px] text-white/30">{sport.totalMatches} matchs</span>
                {sport.liveMatches > 0 && (
                  <span className="flex items-center gap-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    {sport.liveMatches} live
                  </span>
                )}
              </div>
            )}
            {sport.leagues.map((league) => (
              <LeagueSection key={league.slug} league={league} labels={labels} />
            ))}
          </div>
        ))}
    </div>
  );
}