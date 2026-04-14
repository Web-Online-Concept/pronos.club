"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

// ============================================================
// /stats-sports/page.tsx — PRONOS.CLUB Stats Sports
// 4 tabs: Classements | Leaders | Calendrier | Blessures
// ============================================================

// --- Config ---

const FOOTBALL_LEAGUES = [
  { id: "fra.1", name: "Ligue 1", flag: "fr" },
  { id: "eng.1", name: "Premier League", flag: "gb-eng" },
  { id: "esp.1", name: "La Liga", flag: "es" },
  { id: "ita.1", name: "Serie A", flag: "it" },
  { id: "ger.1", name: "Bundesliga", flag: "de" },
  { id: "fra.2", name: "Ligue 2", flag: "fr" },
  { id: "por.1", name: "Liga Portugal", flag: "pt" },
  { id: "ned.1", name: "Eredivisie", flag: "nl" },
  { id: "bel.1", name: "Pro League", flag: "be" },
  { id: "tur.1", name: "Süper Lig", flag: "tr" },
  { id: "uefa.champions", name: "Champions League", flag: "eu" },
  { id: "uefa.europa", name: "Europa League", flag: "eu" },
];

const US_SPORTS = [
  { id: "nba", name: "NBA", icon: "🏀" },
  { id: "nhl", name: "NHL", icon: "🏒" },
  { id: "nfl", name: "NFL", icon: "🏈" },
  { id: "mlb", name: "MLB", icon: "⚾" },
];

const TENNIS_TOURS = [
  { id: "atp", name: "ATP", icon: "🎾" },
  { id: "wta", name: "WTA", icon: "🎾" },
];

type Sport = "football" | "nba" | "nhl" | "nfl" | "mlb" | "tennis";
type View = "standings" | "leaders" | "schedule" | "injuries";

const SPORT_CATEGORIES = [
  { key: "football" as Sport, label: "Football", icon: "⚽" },
  { key: "nba" as Sport, label: "NBA", icon: "🏀" },
  { key: "nhl" as Sport, label: "NHL", icon: "🏒" },
  { key: "nfl" as Sport, label: "NFL", icon: "🏈" },
  { key: "mlb" as Sport, label: "MLB", icon: "⚾" },
  { key: "tennis" as Sport, label: "Tennis", icon: "🎾" },
];

// --- i18n labels ---

const LABELS: Record<string, Record<string, string>> = {
  standings: { fr: "Classements", en: "Standings", es: "Clasificación" },
  leaders: { fr: "Leaders", en: "Leaders", es: "Líderes" },
  schedule: { fr: "Calendrier", en: "Schedule", es: "Calendario" },
  injuries: { fr: "Blessures", en: "Injuries", es: "Lesiones" },
  noData: { fr: "Aucune donnée disponible", en: "No data available", es: "Sin datos disponibles" },
  loading: { fr: "Chargement...", en: "Loading...", es: "Cargando..." },
  noInjuries: { fr: "Blessures indisponibles pour ce sport", en: "Injuries not available for this sport", es: "Lesiones no disponibles para este deporte" },
  matchDay: { fr: "Journée", en: "Matchday", es: "Jornada" },
  venue: { fr: "Stade", en: "Venue", es: "Estadio" },
  broadcast: { fr: "TV", en: "TV", es: "TV" },
  position: { fr: "Pos", en: "Pos", es: "Pos" },
  status: { fr: "Statut", en: "Status", es: "Estado" },
  player: { fr: "Joueur", en: "Player", es: "Jugador" },
  description: { fr: "Détail", en: "Detail", es: "Detalle" },
  today: { fr: "Aujourd'hui", en: "Today", es: "Hoy" },
  tomorrow: { fr: "Demain", en: "Tomorrow", es: "Mañana" },
  vs: { fr: "vs", en: "vs", es: "vs" },
  noUpcoming: { fr: "Aucun match à venir", en: "No upcoming matches", es: "No hay partidos próximos" },
};

function useLocale() {
  // Detect from URL or default fr
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.startsWith("/en")) return "en";
    if (path.startsWith("/es")) return "es";
  }
  return "fr";
}

function t(key: string, locale: string) {
  return LABELS[key]?.[locale] ?? LABELS[key]?.["en"] ?? key;
}

// --- Status color for injuries ---

function injuryStatusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("out") || s.includes("injured reserve") || s.includes("ir")) return "bg-red-500";
  if (s.includes("doubtful")) return "bg-orange-500";
  if (s.includes("questionable")) return "bg-yellow-500";
  if (s.includes("day-to-day") || s.includes("dtd")) return "bg-amber-400";
  if (s.includes("probable")) return "bg-green-400";
  return "bg-gray-400";
}

// --- Date helpers ---

function groupByDate(matches: any[], locale: string) {
  const groups: Record<string, any[]> = {};
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  for (const m of matches) {
    const dateStr = new Date(m.date).toISOString().slice(0, 10);
    let label = dateStr;
    if (dateStr === todayStr) label = t("today", locale);
    else if (dateStr === tomorrowStr) label = t("tomorrow", locale);
    else {
      const d = new Date(m.date);
      label = d.toLocaleDateString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(m);
  }
  return groups;
}

function formatTime(dateStr: string, locale: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Form badge ---

function FormBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    W: "bg-emerald-500 text-white",
    D: "bg-gray-400 text-white",
    L: "bg-red-500 text-white",
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${colors[result] ?? "bg-gray-300"}`}>
      {result}
    </span>
  );
}

// --- Custom Dropdown ---

function Dropdown({
  options,
  value,
  onChange,
  renderOption,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  renderOption?: (opt: { id: string; label: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white hover:border-emerald-500 transition-colors min-w-[160px]"
      >
        {renderOption && selected ? renderOption(selected) : <span>{selected?.label ?? "Select"}</span>}
        <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                opt.id === value ? "text-emerald-400 bg-gray-750" : "text-white"
              }`}
            >
              {renderOption ? renderOption(opt) : opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Flag component ---

function Flag({ code, size = 20 }: { code: string; size?: number }) {
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/w${size}/${code}.png`}
      alt={code}
      width={size}
      height={Math.round(size * 0.75)}
      className="inline-block"
      loading="lazy"
    />
  );
}

// --- Team Logo ---

function TeamLogo({ src, name, size = 24 }: { src?: string | null; name: string; size?: number }) {
  if (!src) return <div className="bg-gray-700 rounded-full" style={{ width: size, height: size }} />;
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className="inline-block object-contain"
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// --- Player Headshot ---

function Headshot({ src, fallback, name, size = 32 }: { src?: string | null; fallback?: string | null; name: string; size?: number }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    if (fallback) return <TeamLogo src={fallback} name={name} size={size} />;
    return <div className="bg-gray-700 rounded-full" style={{ width: size, height: size }} />;
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className="inline-block rounded-full object-cover"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function StatsPage() {
  const locale = useLocale();

  const [sport, setSport] = useState<Sport>("football");
  const [league, setLeague] = useState("fra.1");
  const [view, setView] = useState<View>("standings");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine available views for current sport
  const isUS = ["nba", "nhl", "nfl", "mlb"].includes(sport);
  const isTennis = sport === "tennis";
  const isFootball = sport === "football";

  const availableViews: View[] = isUS
    ? ["standings", "leaders", "schedule", "injuries"]
    : isTennis
    ? ["standings", "schedule"]
    : ["standings", "leaders", "schedule"];

  // Reset view if not available for current sport
  useEffect(() => {
    if (!availableViews.includes(view)) {
      setView("standings");
    }
  }, [sport]);

  // Reset league on sport change
  useEffect(() => {
    if (sport === "football") setLeague("fra.1");
    else if (sport === "tennis") setLeague("atp");
    else setLeague("");
  }, [sport]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);

    const params = new URLSearchParams({ sport, view });
    if (sport === "football" && league) params.set("league", league);
    if (sport === "tennis" && league) params.set("league", league);

    try {
      const res = await fetch(`/api/stats-sports?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data);
      if (json.message) setError(json.message);
    } catch (err: any) {
      setError(err.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }, [sport, league, view]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- League dropdown options ---

  const leagueOptions =
    sport === "football"
      ? FOOTBALL_LEAGUES.map((l) => ({ id: l.id, label: l.name, flag: l.flag }))
      : sport === "tennis"
      ? TENNIS_TOURS.map((t) => ({ id: t.id, label: t.name }))
      : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2">
            📊 Stats Sports
          </h1>
          <p className="text-gray-400 text-center text-sm sm:text-base">
            {locale === "fr"
              ? "Classements, leaders, calendrier et blessures — tous sports"
              : locale === "es"
              ? "Clasificaciones, líderes, calendario y lesiones — todos los deportes"
              : "Standings, leaders, schedule and injuries — all sports"}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-20">
        {/* Sport selector */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {SPORT_CATEGORIES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSport(s.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                sport === s.key
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* League dropdown (football / tennis) */}
        {leagueOptions.length > 0 && (
          <div className="flex justify-center mb-6">
            <Dropdown
              options={leagueOptions}
              value={league}
              onChange={setLeague}
              renderOption={(opt: any) => (
                <span className="flex items-center gap-2">
                  {opt.flag && <Flag code={opt.flag} size={20} />}
                  {opt.label}
                </span>
              )}
            />
          </div>
        )}

        {/* View toggle */}
        <div className="flex flex-wrap gap-1 justify-center mb-8">
          {availableViews.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === v
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {t(v, locale)}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">{t("loading", locale)}</div>
        ) : error && !data ? (
          <div className="text-center py-20 text-gray-400">{error}</div>
        ) : !data ? (
          <div className="text-center py-20 text-gray-400">{t("noData", locale)}</div>
        ) : (
          <>
            {view === "standings" && <StandingsView data={data} sport={sport} locale={locale} />}
            {view === "leaders" && <LeadersView data={data} sport={sport} locale={locale} />}
            {view === "schedule" && <ScheduleView data={data} sport={sport} locale={locale} />}
            {view === "injuries" && <InjuriesView data={data} sport={sport} locale={locale} />}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// STANDINGS VIEW (existing logic preserved)
// ============================================================

function StandingsView({ data, sport, locale }: { data: any; sport: Sport; locale: string }) {
  if (!data) return null;

  // Football standings
  if (sport === "football" && Array.isArray(data)) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="text-left py-3 px-2 w-8">#</th>
              <th className="text-left py-3 px-2">{locale === "fr" ? "Équipe" : "Team"}</th>
              <th className="py-3 px-1 text-center hidden sm:table-cell">MJ</th>
              <th className="py-3 px-1 text-center">V</th>
              <th className="py-3 px-1 text-center">N</th>
              <th className="py-3 px-1 text-center">D</th>
              <th className="py-3 px-1 text-center hidden sm:table-cell">BP</th>
              <th className="py-3 px-1 text-center hidden sm:table-cell">BC</th>
              <th className="py-3 px-1 text-center hidden sm:table-cell">Diff</th>
              <th className="py-3 px-1 text-center font-bold">Pts</th>
              <th className="py-3 px-2 text-center hidden sm:table-cell">{locale === "fr" ? "Forme" : "Form"}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, i: number) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors">
                <td className="py-3 px-2 text-gray-400 text-xs">{row.position}</td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <TeamLogo src={row.team?.logo} name={row.team?.name} size={20} />
                    <span className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                      {row.team?.name}
                    </span>
                  </div>
                  {/* Mobile form */}
                  {row.form && row.form.length > 0 && (
                    <div className="flex gap-1 mt-1 sm:hidden">
                      {row.form.map((r: string, j: number) => (
                        <FormBadge key={j} result={r} />
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-3 px-1 text-center text-gray-300 hidden sm:table-cell">{row.gamesPlayed}</td>
                <td className="py-3 px-1 text-center text-emerald-400">{row.wins}</td>
                <td className="py-3 px-1 text-center text-gray-300">{row.draws}</td>
                <td className="py-3 px-1 text-center text-red-400">{row.losses}</td>
                <td className="py-3 px-1 text-center text-gray-300 hidden sm:table-cell">{row.goalsFor}</td>
                <td className="py-3 px-1 text-center text-gray-300 hidden sm:table-cell">{row.goalsAgainst}</td>
                <td className={`py-3 px-1 text-center hidden sm:table-cell ${row.goalDiff > 0 ? "text-emerald-400" : row.goalDiff < 0 ? "text-red-400" : "text-gray-300"}`}>
                  {row.goalDiff > 0 ? "+" : ""}{row.goalDiff}
                </td>
                <td className="py-3 px-1 text-center font-bold text-white">{row.points}</td>
                <td className="py-3 px-2 hidden sm:table-cell">
                  {row.form && (
                    <div className="flex gap-1 justify-center">
                      {row.form.map((r: string, j: number) => (
                        <FormBadge key={j} result={r} />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // US standings (conferences)
  if (Array.isArray(data)) {
    return (
      <div className="space-y-8">
        {data.map((conf: any, ci: number) => (
          <div key={ci}>
            <h3 className="text-lg font-bold text-emerald-400 mb-3">{conf.name}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left py-3 px-2">{locale === "fr" ? "Équipe" : "Team"}</th>
                    <th className="py-3 px-1 text-center">MJ</th>
                    <th className="py-3 px-1 text-center">V</th>
                    <th className="py-3 px-1 text-center">D</th>
                    <th className="py-3 px-1 text-center">%</th>
                    <th className="py-3 px-1 text-center">{locale === "fr" ? "Série" : "Streak"}</th>
                  </tr>
                </thead>
                <tbody>
                  {conf.teams?.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <TeamLogo src={row.team?.logo} name={row.team?.name} size={20} />
                          <span className="font-medium text-xs sm:text-sm">{row.team?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-1 text-center text-gray-300">{row.gamesPlayed}</td>
                      <td className="py-3 px-1 text-center text-emerald-400">{row.wins}</td>
                      <td className="py-3 px-1 text-center text-red-400">{row.losses}</td>
                      <td className="py-3 px-1 text-center text-white font-medium">{row.winPct}</td>
                      <td className="py-3 px-1 text-center text-gray-300">{row.streak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Tennis rankings
  if (sport === "tennis" && Array.isArray(data)) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-800">
              <th className="text-left py-3 px-2 w-12">#</th>
              <th className="text-left py-3 px-2">{t("player", locale)}</th>
              <th className="py-3 px-2 text-center">Pts</th>
              <th className="py-3 px-2 text-center">+/-</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, i: number) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="py-3 px-2 text-gray-400">{row.rank}</td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <Headshot src={row.athlete?.headshot} name={row.athlete?.name} size={28} />
                    {row.athlete?.countryCode && <Flag code={row.athlete.countryCode} size={16} />}
                    <span className="font-medium">{row.athlete?.name}</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center text-white font-medium">{row.points}</td>
                <td className={`py-3 px-2 text-center ${row.movement > 0 ? "text-emerald-400" : row.movement < 0 ? "text-red-400" : "text-gray-500"}`}>
                  {row.movement > 0 ? `▲${row.movement}` : row.movement < 0 ? `▼${Math.abs(row.movement)}` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div className="text-center py-20 text-gray-400">{t("noData", locale)}</div>;
}

// ============================================================
// LEADERS VIEW (existing logic preserved)
// ============================================================

function LeadersView({ data, sport, locale }: { data: any; sport: Sport; locale: string }) {
  if (!data || typeof data !== "object") return <div className="text-center py-20 text-gray-400">{t("noData", locale)}</div>;

  const categories = Object.entries(data);
  if (categories.length === 0) return <div className="text-center py-20 text-gray-400">{t("noData", locale)}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {categories.map(([catName, leaders]: [string, any]) => (
        <div key={catName} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-emerald-400 font-bold text-sm mb-3 uppercase tracking-wide">{catName}</h3>
          <div className="space-y-2">
            {(leaders as any[]).map((l: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <span className="text-gray-500 text-xs w-5 text-right">{i + 1}</span>
                <Headshot src={l.athlete?.headshot} fallback={l.athlete?.teamLogo} name={l.athlete?.name} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{l.athlete?.name}</div>
                  <div className="text-xs text-gray-400 truncate">{l.athlete?.teamAbbr || l.athlete?.team}</div>
                </div>
                <span className="text-white font-bold text-sm">{l.displayValue}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SCHEDULE VIEW (NEW — Phase 2)
// ============================================================

function ScheduleView({ data, sport, locale }: { data: any; sport: Sport; locale: string }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-center py-20 text-gray-400">{t("noUpcoming", locale)}</div>;
  }

  const isTennisSport = sport === "tennis";
  const grouped = groupByDate(data, locale);
  const dateKeys = Object.keys(grouped);

  return (
    <div className="space-y-6">
      {dateKeys.map((dateLabel) => (
        <div key={dateLabel}>
          <h3 className="text-emerald-400 font-bold text-sm mb-3 uppercase tracking-wide sticky top-0 bg-gray-950 py-2 z-10">
            {dateLabel}
          </h3>
          <div className="space-y-2">
            {grouped[dateLabel].map((match: any, i: number) => (
              <div
                key={match.id ?? i}
                className="bg-gray-900 rounded-xl p-3 sm:p-4 border border-gray-800 hover:border-gray-700 transition-colors"
              >
                {isTennisSport ? (
                  // Tennis match layout
                  <div>
                    <div className="text-xs text-gray-500 mb-2">{match.tournament || match.venue}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-1">
                        {match.players?.map((p: any, pi: number) => (
                          <div key={pi} className="flex items-center gap-2">
                            <Headshot src={p.headshot} name={p.name} size={24} />
                            {p.countryCode && <Flag code={p.countryCode} size={14} />}
                            <span className="text-sm font-medium">{p.name}</span>
                            {p.seed && <span className="text-xs text-gray-500">[{p.seed}]</span>}
                          </div>
                        ))}
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-mono text-sm">{formatTime(match.date, locale)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Football / US sport match layout
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Home */}
                    <div className="flex-1 flex items-center justify-end gap-2 text-right">
                      <span className="text-sm font-medium truncate hidden sm:inline">{match.home?.name}</span>
                      <span className="text-sm font-medium truncate sm:hidden">{match.home?.shortName || match.home?.name}</span>
                      <TeamLogo src={match.home?.logo} name={match.home?.name ?? ""} size={28} />
                    </div>

                    {/* Time */}
                    <div className="flex flex-col items-center min-w-[60px]">
                      <span className="text-emerald-400 font-mono text-sm font-bold">{formatTime(match.date, locale)}</span>
                      {match.venue && (
                        <span className="text-[10px] text-gray-500 mt-0.5 hidden sm:block truncate max-w-[120px]">{match.venue}</span>
                      )}
                      {match.broadcast && (
                        <span className="text-[10px] text-gray-500">{match.broadcast}</span>
                      )}
                    </div>

                    {/* Away */}
                    <div className="flex-1 flex items-center gap-2">
                      <TeamLogo src={match.away?.logo} name={match.away?.name ?? ""} size={28} />
                      <span className="text-sm font-medium truncate hidden sm:inline">{match.away?.name}</span>
                      <span className="text-sm font-medium truncate sm:hidden">{match.away?.shortName || match.away?.name}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// INJURIES VIEW (NEW — Phase 2)
// ============================================================

function InjuriesView({ data, sport, locale }: { data: any; sport: Sport; locale: string }) {
  // Injuries only for US sports
  if (!["nba", "nhl", "nfl", "mlb"].includes(sport)) {
    return <div className="text-center py-20 text-gray-400">{t("noInjuries", locale)}</div>;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-center py-20 text-gray-400">{t("noData", locale)}</div>;
  }

  return (
    <div className="space-y-6">
      {data.map((teamEntry: any, ti: number) => (
        <div key={ti} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {/* Team header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 border-b border-gray-800">
            <TeamLogo src={teamEntry.team?.logo} name={teamEntry.team?.name} size={28} />
            <h3 className="font-bold text-sm">{teamEntry.team?.name}</h3>
            <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
              {teamEntry.injuries?.length ?? 0}
            </span>
          </div>

          {/* Injuries list */}
          <div className="divide-y divide-gray-800/50">
            {teamEntry.injuries?.map((inj: any, ii: number) => (
              <div key={ii} className="flex items-start gap-3 px-4 py-3">
                <Headshot src={inj.athlete?.headshot} name={inj.athlete?.name} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{inj.athlete?.name}</span>
                    {inj.athlete?.position && (
                      <span className="text-xs text-gray-500">{inj.athlete.position}</span>
                    )}
                  </div>
                  {inj.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{inj.description}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${injuryStatusColor(inj.status)}`}>
                    {inj.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}