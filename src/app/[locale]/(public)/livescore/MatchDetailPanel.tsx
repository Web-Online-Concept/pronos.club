"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

/* ── Types ── */
interface MatchDetailTeam {
  name: string;
  abbreviation: string;
  logo: string;
  score: string;
  homeAway: string;
  form: string;
  record: string;
  linescores: string[];
  formation: string;
  color: string;
}

interface MatchDetailEvent {
  id: string;
  type: string;
  minute: string;
  text: string;
  shortText: string;
  team: string;
  teamId: string;
  scoringPlay: boolean;
  participants: { name: string; role: string }[];
  period: number;
}

interface MatchDetailStat {
  name: string;
  displayName: string;
  home: string;
  away: string;
  homeValue: number;
  awayValue: number;
}

interface MatchDetailPlayer {
  name: string;
  shortName: string;
  jersey: string;
  position: string;
  starter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  formationPlace: number;
}

interface MatchDetailRoster {
  teamName: string;
  teamId: string;
  formation: string;
  starters: MatchDetailPlayer[];
  substitutes: MatchDetailPlayer[];
}

interface StandingEntry {
  rank: string;
  team: string;
  logo: string;
  played: string;
  wins: string;
  draws: string;
  losses: string;
  goalDiff: string;
  points: string;
  isHome: boolean;
  isAway: boolean;
}

interface MatchDetail {
  id: string;
  status: string;
  statusText: string;
  venue: string;
  venueCity: string;
  home: MatchDetailTeam;
  away: MatchDetailTeam;
  events: MatchDetailEvent[];
  stats: MatchDetailStat[];
  rosters: MatchDetailRoster[];
  h2h: { date: string; score: string; competition: string }[];
  standings: StandingEntry[];
}

/* ── Event icon ── */
function eventIcon(type: string): string {
  switch (type) {
    case "goal": return "⚽";
    case "yellow-card": return "🟨";
    case "red-card": return "🟥";
    case "substitution": return "🔄";
    case "kickoff": return "🟢";
    case "halftime": return "⏸️";
    case "end-regular-time": return "🏁";
    case "start-2nd-half": return "▶️";
    case "penalty-goal": return "⚽🎯";
    case "penalty-miss": return "❌🎯";
    case "var": return "📺";
    default: return "•";
  }
}

/* ── Tabs ── */
type Tab = "stats" | "events" | "lineups" | "standings";

/* ── Stat bar ── */
function StatBar({ stat, homeId, awayId }: { stat: MatchDetailStat; homeId?: string; awayId?: string }) {
  const total = stat.homeValue + stat.awayValue;
  const homePct = total > 0 ? (stat.homeValue / total) * 100 : 50;
  const isPossession = stat.name === "possessionPct";

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="w-12 text-right font-bold text-neutral-700">{isPossession ? `${stat.home}%` : stat.home}</span>
        <span className="flex-1 text-center text-[11px] text-neutral-400">{stat.displayName}</span>
        <span className="w-12 text-left font-bold text-neutral-700">{isPossession ? `${stat.away}%` : stat.away}</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="rounded-l-full bg-blue-500 transition-all duration-500"
          style={{ width: `${homePct}%` }}
        />
        <div
          className="rounded-r-full bg-red-400 transition-all duration-500"
          style={{ width: `${100 - homePct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Events timeline ── */
function EventsTimeline({ events, home, away }: { events: MatchDetailEvent[]; home: MatchDetailTeam; away: MatchDetailTeam }) {
  // Filter only interesting events
  const filtered = events.filter((e) =>
    ["goal", "yellow-card", "red-card", "substitution", "halftime", "kickoff", "end-regular-time", "start-2nd-half", "penalty-goal", "penalty-miss", "var"].includes(e.type)
  );

  if (!filtered.length) return <p className="py-6 text-center text-sm text-neutral-400">Aucun événement disponible</p>;

  return (
    <div className="divide-y divide-neutral-100">
      {filtered.map((event) => {
        const isHome = event.teamId === home.abbreviation || event.team === home.name ||
          (home as any).id === event.teamId;
        const isGoal = event.scoringPlay;
        const isHalfMarker = ["halftime", "kickoff", "end-regular-time", "start-2nd-half"].includes(event.type);

        if (isHalfMarker) {
          return (
            <div key={event.id} className="flex items-center justify-center gap-2 py-2 bg-neutral-50">
              <span className="text-xs">{eventIcon(event.type)}</span>
              <span className="text-[11px] font-semibold text-neutral-400">{event.text}</span>
            </div>
          );
        }

        return (
          <div
            key={event.id}
            className={`flex items-start gap-2 px-3 py-2 ${isGoal ? "bg-green-50" : ""}`}
          >
            <span className="w-10 shrink-0 text-right text-[12px] font-bold text-neutral-500">{event.minute}</span>
            <span className="text-sm">{eventIcon(event.type)}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-[12px] ${isGoal ? "font-bold text-green-700" : "text-neutral-600"}`}>
                {event.shortText || event.text}
              </p>
              {event.team && (
                <p className="text-[10px] text-neutral-400">{event.team}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Lineups ── */
function LineupsView({ rosters }: { rosters: MatchDetailRoster[] }) {
  if (!rosters.length) return <p className="py-6 text-center text-sm text-neutral-400">Compositions non disponibles</p>;

  return (
    <div className="grid grid-cols-2 gap-px bg-neutral-100">
      {rosters.map((roster) => (
        <div key={roster.teamName} className="bg-white">
          {/* Team header */}
          <div className="border-b border-neutral-100 px-2 py-2 text-center">
            <p className="text-[11px] font-bold text-neutral-700">{roster.teamName}</p>
            {roster.formation && (
              <p className="text-[10px] text-neutral-400">{roster.formation}</p>
            )}
          </div>
          {/* Starters */}
          <div className="px-1">
            {roster.starters.map((p) => (
              <div
                key={`${p.jersey}-${p.name}`}
                className={`flex items-center gap-1 border-b border-neutral-50 px-1.5 py-[5px] ${
                  p.subbedOut ? "opacity-50" : ""
                }`}
              >
                <span className="w-5 text-center text-[10px] font-bold text-neutral-400">{p.jersey}</span>
                <span className="flex-1 truncate text-[11px] font-medium text-neutral-700">{p.shortName}</span>
                <span className="text-[9px] text-neutral-400">{p.position}</span>
                {p.subbedOut && <span className="text-[9px]">🔻</span>}
              </div>
            ))}
          </div>
          {/* Substitutes header */}
          {roster.substitutes.length > 0 && (
            <>
              <div className="border-t border-neutral-200 bg-neutral-50 px-2 py-1">
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Remplaçants</p>
              </div>
              <div className="px-1">
                {roster.substitutes.map((p) => (
                  <div
                    key={`${p.jersey}-${p.name}`}
                    className="flex items-center gap-1 border-b border-neutral-50 px-1.5 py-[5px]"
                  >
                    <span className="w-5 text-center text-[10px] font-bold text-neutral-300">{p.jersey}</span>
                    <span className={`flex-1 truncate text-[11px] ${p.subbedIn ? "font-medium text-neutral-700" : "text-neutral-400"}`}>
                      {p.shortName}
                    </span>
                    <span className="text-[9px] text-neutral-400">{p.position}</span>
                    {p.subbedIn && <span className="text-[9px]">🔺</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Standings table ── */
function StandingsView({ standings, homeName, awayName }: { standings: StandingEntry[]; homeName: string; awayName: string }) {
  if (!standings.length) return <p className="py-6 text-center text-sm text-neutral-400">Classement non disponible</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-400">
            <th className="py-1.5 pl-2 pr-1 text-left font-semibold w-6">#</th>
            <th className="py-1.5 text-left font-semibold">Équipe</th>
            <th className="py-1.5 px-1 text-center font-semibold w-7">MJ</th>
            <th className="py-1.5 px-1 text-center font-semibold w-7">V</th>
            <th className="py-1.5 px-1 text-center font-semibold w-7">N</th>
            <th className="py-1.5 px-1 text-center font-semibold w-7">D</th>
            <th className="py-1.5 px-1 text-center font-semibold w-8">DB</th>
            <th className="py-1.5 px-1 pr-2 text-center font-bold w-8">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry, i) => {
            const isHighlighted = entry.isHome || entry.isAway;
            return (
              <tr
                key={i}
                className={`border-b border-neutral-50 ${
                  isHighlighted ? "bg-emerald-50 font-semibold" : "hover:bg-neutral-50"
                }`}
              >
                <td className="py-1 pl-2 pr-1 text-neutral-400 font-bold">{entry.rank}</td>
                <td className="py-1 flex items-center gap-1.5">
                  {entry.logo && (
                    <Image src={entry.logo} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" unoptimized />
                  )}
                  <span className={isHighlighted ? "text-emerald-700" : "text-neutral-700"}>{entry.team}</span>
                </td>
                <td className="py-1 px-1 text-center text-neutral-500">{entry.played}</td>
                <td className="py-1 px-1 text-center text-neutral-500">{entry.wins}</td>
                <td className="py-1 px-1 text-center text-neutral-500">{entry.draws}</td>
                <td className="py-1 px-1 text-center text-neutral-500">{entry.losses}</td>
                <td className="py-1 px-1 text-center text-neutral-500">{entry.goalDiff}</td>
                <td className="py-1 px-1 pr-2 text-center font-bold text-neutral-800">{entry.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main component ── */
export default function MatchDetailPanel({
  matchId,
  sport,
  league,
  isOpen,
}: {
  matchId: string;
  sport: string;
  league: string;
  isOpen: boolean;
}) {
  const [data, setData] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("stats");

  useEffect(() => {
    if (!isOpen || !matchId) return;
    setLoading(true);
    setError(false);

    fetch(`/api/livescore/match/${matchId}?sport=${sport}&league=${league}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isOpen, matchId, sport, league]);

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-white py-8 border-b border-neutral-100">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <span className="ml-2 text-xs text-neutral-400">Chargement...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center bg-white py-6 border-b border-neutral-100">
        <span className="text-xs text-neutral-400">Détails non disponibles</span>
      </div>
    );
  }

  const hasStats = data.stats.length > 0;
  const hasEvents = data.events.length > 0;
  const hasLineups = data.rosters.length > 0 && data.rosters.some((r) => r.starters.length > 0);
  const hasStandings = data.standings && data.standings.length > 0;

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: "stats", label: "Stats", available: hasStats },
    { key: "events", label: "Événements", available: hasEvents },
    { key: "lineups", label: "Compos", available: hasLineups },
    { key: "standings", label: "Classement", available: hasStandings },
  ];

  // Auto-select first available tab
  const availableTabs = tabs.filter((t) => t.available);
  if (availableTabs.length > 0 && !availableTabs.find((t) => t.key === activeTab)) {
    // Don't setState in render — handled by initial state or effect
  }

  return (
    <div className="bg-white border-b-2 border-emerald-500/30">
      {/* Match header */}
      <div className="bg-[#f8f9fa] px-3 py-3 text-center border-b border-neutral-100">
        {/* Score line */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            {data.home.logo && (
              <Image src={data.home.logo} alt={data.home.abbreviation} width={24} height={24} className="h-6 w-6 object-contain" unoptimized />
            )}
            <span className="text-[13px] font-bold text-neutral-800">{data.home.abbreviation}</span>
          </div>
          <div className="flex items-center gap-1 rounded bg-neutral-800 px-3 py-1">
            <span className="text-[16px] font-extrabold text-white">{data.home.score}</span>
            <span className="text-[12px] text-white/50">-</span>
            <span className="text-[16px] font-extrabold text-white">{data.away.score}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-neutral-800">{data.away.abbreviation}</span>
            {data.away.logo && (
              <Image src={data.away.logo} alt={data.away.abbreviation} width={24} height={24} className="h-6 w-6 object-contain" unoptimized />
            )}
          </div>
        </div>

        {/* Half-time scores */}
        {data.home.linescores.length > 0 && (
          <p className="mt-1 text-[10px] text-neutral-400">
            MT: {data.home.linescores[0]} - {data.away.linescores[0]}
          </p>
        )}

        {/* Status + venue */}
        <p className="mt-1 text-[10px] text-neutral-400">{data.statusText}</p>
        {data.venue && (
          <p className="text-[9px] text-neutral-300">{data.venue}{data.venueCity ? `, ${data.venueCity}` : ""}</p>
        )}

        {/* Formations */}
        {(data.home.formation || data.away.formation) && (
          <div className="mt-1 flex items-center justify-center gap-3">
            {data.home.formation && <span className="text-[10px] text-neutral-400">{data.home.formation}</span>}
            <span className="text-[9px] text-neutral-300">vs</span>
            {data.away.formation && <span className="text-[10px] text-neutral-400">{data.away.formation}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => tab.available && setActiveTab(tab.key)}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wide transition cursor-pointer border-b-2 ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-600"
                : tab.available
                ? "border-transparent text-neutral-400 hover:text-neutral-600"
                : "border-transparent text-neutral-200 cursor-default"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-h-[400px] overflow-y-auto">
        {activeTab === "stats" && hasStats && (
          <div className="px-3 py-2 sm:px-6">
            {data.stats.map((stat) => (
              <StatBar key={stat.name} stat={stat} />
            ))}
          </div>
        )}

        {activeTab === "events" && hasEvents && (
          <EventsTimeline events={data.events} home={data.home} away={data.away} />
        )}

        {activeTab === "lineups" && hasLineups && (
          <LineupsView rosters={data.rosters} />
        )}

        {activeTab === "standings" && hasStandings && (
          <StandingsView standings={data.standings} homeName={data.home.name} awayName={data.away.name} />
        )}

        {/* H2H */}
        {data.h2h.length > 0 && activeTab === "stats" && (
          <div className="border-t border-neutral-100 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Confrontations</p>
            {data.h2h.slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className="text-[10px] text-neutral-300">{h.date ? new Date(h.date).toLocaleDateString() : ""}</span>
                <span className="text-[11px] font-bold text-neutral-600">{h.score}</span>
                <span className="text-[9px] text-neutral-300">{h.competition}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}