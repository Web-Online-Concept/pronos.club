"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import MatchDetailPanel from "./MatchDetailPanel";

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
const SPORT_ESPN_MAP: Record<string, string> = {
  football: "soccer",
  tennis: "tennis",
  basketball: "basketball",
  hockey: "hockey",
  baseball: "baseball",
  "football-us": "football",
  mma: "mma",
  rugby: "rugby",
  cricket: "cricket",
  golf: "golf",
};

const SPORT_TABS = [
  { key: "all", icon: "🏟️", label: "FAVORIS" },
  { key: "football", icon: "⚽", label: "FOOTBALL" },
  { key: "tennis", icon: "🎾", label: "TENNIS" },
  { key: "basketball", icon: "🏀", label: "BASKET" },
  { key: "hockey", icon: "🏒", label: "HOCKEY" },
  { key: "baseball", icon: "⚾", label: "BASEBALL" },
  { key: "football-us", icon: "🏈", label: "NFL" },
  { key: "mma", icon: "🥊", label: "MMA" },
  { key: "rugby", icon: "🏉", label: "RUGBY" },
  { key: "cricket", icon: "🏏", label: "CRICKET" },
  { key: "golf", icon: "⛳", label: "GOLF" },
];

/* ── Status badge ──────────────────────────── */
function StatusBadge({ match, labels }: { match: LiveMatch; labels: Labels }) {
  if (match.status === "live") {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-[10px] font-bold text-red-500 leading-tight">
          {match.clock || match.statusText || labels.live}
        </span>
      </div>
    );
  }
  if (match.status === "scheduled") {
    return <span className="text-[12px] font-medium text-neutral-500">{formatTime(match.startTime)}</span>;
  }
  if (match.status === "finished") {
    return <span className="text-[10px] font-semibold text-neutral-400">{match.statusText || labels.finished}</span>;
  }
  if (match.status === "postponed") {
    return <span className="text-[10px] font-semibold text-amber-600">{labels.postponed}</span>;
  }
  return <span className="text-[10px] text-neutral-400">{match.statusText}</span>;
}

/* ── Team logo ─────────────────────────────── */
function TeamLogo({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded bg-neutral-100 text-[8px] font-bold text-neutral-400">
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={20}
      height={20}
      className="h-5 w-5 object-contain"
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
      className={`flex items-center border-b border-neutral-100 px-3 py-[9px] transition cursor-pointer sm:px-4 ${
        isLive ? "bg-red-50/50" : "hover:bg-neutral-50"
      }`}
    >
      {/* Status column */}
      <div className="w-14 shrink-0 text-center sm:w-16">
        <StatusBadge match={match} labels={labels} />
      </div>

      {/* Teams */}
      <div className="flex flex-1 flex-col gap-[3px] min-w-0">
        <div className="flex items-center gap-2">
          <TeamLogo src={match.homeLogo} alt={match.homeAbbr || match.homeTeam} />
          <span className={`flex-1 truncate text-[13px] ${isFinished ? "text-neutral-400" : "text-neutral-800"} ${isLive ? "font-semibold" : "font-medium"}`}>
            {match.homeTeam}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TeamLogo src={match.awayLogo} alt={match.awayAbbr || match.awayTeam} />
          <span className={`flex-1 truncate text-[13px] ${isFinished ? "text-neutral-400" : "text-neutral-800"} ${isLive ? "font-semibold" : "font-medium"}`}>
            {match.awayTeam}
          </span>
        </div>
      </div>

      {/* Scores */}
      <div className="flex flex-col gap-[3px] shrink-0 min-w-[32px]">
        <span
          className={`text-right font-mono text-[13px] font-bold whitespace-nowrap ${
            isLive ? "text-red-500" : isFinished ? "text-neutral-500" : "text-neutral-300"
          }`}
        >
          {isScheduled ? "-" : match.homeScore}
        </span>
        <span
          className={`text-right font-mono text-[13px] font-bold whitespace-nowrap ${
            isLive ? "text-red-500" : isFinished ? "text-neutral-500" : "text-neutral-300"
          }`}
        >
          {isScheduled ? "-" : match.awayScore}
        </span>
      </div>
    </div>
  );
}

/* ── League section ────────────────────────── */
function LeagueSection({ league, labels, espnSport }: { league: LiveLeague; labels: Labels; espnSport: string }) {
  const liveCount = league.matches.filter((m) => m.status === "live").length;
  const [collapsed, setCollapsed] = useState(false);
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);

  const handleMatchClick = (matchId: string) => {
    setOpenMatchId((prev) => (prev === matchId ? null : matchId));
  };

  return (
    <div className="mb-1 overflow-hidden bg-white">
      {/* League header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 border-b border-[#d6dce8] bg-[#e8ecf3] px-3 py-[7px] cursor-pointer hover:bg-[#dde2ed] transition sm:px-4"
      >
        {league.flag && <span className="text-sm">{league.flag}</span>}
        <span className="text-[12px] font-bold text-[#3a4a6b] uppercase tracking-wide">{league.name}</span>
        {liveCount > 0 && (
          <span className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {liveCount}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-neutral-300">{league.matches.length}</span>
          <svg
            className={`h-3.5 w-3.5 text-neutral-400 transition ${collapsed ? "-rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {/* Matches */}
      {!collapsed && (
        <div>
          {league.matches.map((match) => (
            <div key={match.id}>
              <div onClick={() => handleMatchClick(match.id)}>
                <MatchRow match={match} labels={labels} />
              </div>
              <MatchDetailPanel
                matchId={match.id}
                sport={espnSport}
                league={league.slug}
                isOpen={openMatchId === match.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Date navigation ───────────────────────── */
function DateNav({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const shift = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    onChange(d);
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const days: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const dayNames = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
  const monthNames = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

  return (
    <div className="flex items-center justify-center bg-white border-b border-neutral-200 px-2 py-2">
      {/* Left arrow */}
      <button onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100 cursor-pointer transition">
        <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Days */}
      <div className="flex items-center gap-0.5 sm:gap-1 mx-1 sm:mx-3">
        {days.map((d, i) => {
          const selected = d.getDate() === date.getDate() && d.getMonth() === date.getMonth();
          const today = isToday(d);
          return (
            <button
              key={i}
              onClick={() => onChange(d)}
              className={`flex flex-col items-center rounded-md px-2 py-1 sm:px-3 sm:py-1.5 transition cursor-pointer ${
                selected
                  ? "bg-emerald-600 text-white"
                  : today
                  ? "bg-emerald-50 text-emerald-700 font-semibold"
                  : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              <span className="text-[9px] font-bold uppercase leading-tight sm:text-[10px]">{dayNames[d.getDay()]}</span>
              <span className="text-[13px] font-bold leading-tight sm:text-[15px]">{d.getDate()}</span>
              <span className="text-[8px] leading-tight sm:text-[9px]">{monthNames[d.getMonth()]}</span>
            </button>
          );
        })}
      </div>

      {/* Right arrow */}
      <button onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100 cursor-pointer transition">
        <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/* ── Filter tabs (TOUS / DIRECT / TERMINÉS / PRÉVUS) ───── */
function FilterTabs({
  active,
  onChange,
  labels,
  liveCount,
}: {
  active: string;
  onChange: (f: string) => void;
  labels: Labels;
  liveCount: number;
}) {
  const filters = [
    { key: "all", label: "TOUS" },
    { key: "live", label: "DIRECT" },
    { key: "finished", label: "TERMINÉS" },
    { key: "scheduled", label: "PRÉVUS" },
  ];

  return (
    <div className="flex items-center gap-1 bg-white px-3 py-2 border-b border-neutral-200 sm:px-4">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition cursor-pointer ${
            active === f.key
              ? "bg-emerald-600 text-white"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          }`}
        >
          {f.label}
          {f.key === "live" && liveCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {liveCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────── */
export default function LivescoreClient({ labels }: { labels: Labels }) {
  const [sports, setSports] = useState<LiveSport[]>([]);
  const [activeSport, setActiveSport] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
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
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/livescore?sport=${sportParam}&date=${dateStr}&tz=${encodeURIComponent(tz)}`);
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

  useEffect(() => {
    fetchData(true);
    intervalRef.current = setInterval(() => fetchData(false), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const totalLive = sports.reduce((sum, s) => sum + s.liveMatches, 0);

  // Filter matches
  const filteredSports = sports.map((sport) => ({
    ...sport,
    leagues: sport.leagues
      .map((league) => ({
        ...league,
        matches: league.matches.filter((m) => {
          if (activeFilter === "all") return true;
          if (activeFilter === "live") return m.status === "live";
          if (activeFilter === "finished") return m.status === "finished";
          if (activeFilter === "scheduled") return m.status === "scheduled";
          return true;
        }),
      }))
      .filter((l) => l.matches.length > 0),
  })).filter((s) => s.leagues.length > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
      {/* Sport tabs bar — FlashScore style top bar */}
      <div className="flex items-center gap-0 overflow-x-auto bg-[#1a1a2e] scrollbar-none">
        {SPORT_TABS.map((tab) => {
          const isActive = activeSport === tab.key;
          const sportData = sports.find((s) => s.key === tab.key);
          const liveCount = tab.key === "all" ? totalLive : (sportData?.liveMatches ?? 0);

          return (
            <button
              key={tab.key}
              onClick={() => setActiveSport(tab.key)}
              className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-[11px] font-bold uppercase tracking-wide transition cursor-pointer border-b-2 ${
                isActive
                  ? "border-emerald-500 text-white bg-white/5"
                  : "border-transparent text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {liveCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                  {liveCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Date navigation */}
      <DateNav date={selectedDate} onChange={setSelectedDate} />

      {/* Filter tabs */}
      <FilterTabs active={activeFilter} onChange={setActiveFilter} labels={labels} liveCount={totalLive} />

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center bg-white py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-3 text-sm text-neutral-400">{labels.loading}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && filteredSports.length === 0 && (
        <div className="flex flex-col items-center justify-center bg-white py-20">
          <span className="text-4xl">🏟️</span>
          <p className="mt-3 text-sm text-neutral-400">{labels.noMatches}</p>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="bg-[#f5f5f5]">
          {filteredSports.map((sport) => (
            <div key={sport.key}>
              {/* Sport header (only in "all" view) */}
              {activeSport === "all" && (
                <div className="flex items-center gap-2 bg-[#dde1e8] px-3 py-1.5 sm:px-4">
                  <span className="text-sm">{sport.icon}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#3a4a6b]">{sport.name}</span>
                  {sport.liveMatches > 0 && (
                    <span className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      {sport.liveMatches}
                    </span>
                  )}
                </div>
              )}
              {sport.leagues.map((league) => (
                <LeagueSection key={league.slug} league={league} labels={labels} espnSport={SPORT_ESPN_MAP[sport.key] ?? "soccer"} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}