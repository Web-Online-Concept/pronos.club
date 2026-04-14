// src/app/[locale]/(public)/stats-sports/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "next-intl";

// ── Config ──
const SPORTS = [
  { id: "football", label: "Football", hasLeagues: true, hasLeaders: true, hasSchedule: true },
  { id: "nba", label: "NBA", hasLeaders: true, hasSchedule: true, hasInjuries: true },
  { id: "nhl", label: "NHL", hasLeaders: true, hasSchedule: true, hasInjuries: true },
  { id: "tennis", label: "Tennis", hasSchedule: true },
  { id: "nfl", label: "NFL", hasLeaders: true, hasSchedule: true, hasInjuries: true },
  { id: "mlb", label: "MLB", hasLeaders: true, hasSchedule: true, hasInjuries: true },
];

const FOOTBALL_LEAGUES = [
  { id: "fra.1", name: "Ligue 1", flag: "https://flagcdn.com/w40/fr.png" },
  { id: "eng.1", name: "Premier League", flag: "https://flagcdn.com/w40/gb-eng.png" },
  { id: "esp.1", name: "La Liga", flag: "https://flagcdn.com/w40/es.png" },
  { id: "ita.1", name: "Serie A", flag: "https://flagcdn.com/w40/it.png" },
  { id: "ger.1", name: "Bundesliga", flag: "https://flagcdn.com/w40/de.png" },
  { id: "fra.2", name: "Ligue 2", flag: "https://flagcdn.com/w40/fr.png" },
  { id: "por.1", name: "Liga Portugal", flag: "https://flagcdn.com/w40/pt.png" },
  { id: "ned.1", name: "Eredivisie", flag: "https://flagcdn.com/w40/nl.png" },
  { id: "bel.1", name: "Pro League", flag: "https://flagcdn.com/w40/be.png" },
  { id: "tur.1", name: "Süper Lig", flag: "https://flagcdn.com/w40/tr.png" },
  { id: "uefa.champions", name: "Champions League", flag: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png" },
  { id: "uefa.europa", name: "Europa League", flag: "https://a.espncdn.com/i/leaguelogos/soccer/500/2310.png" },
];

const TENNIS_TOURS = [
  { id: "atp", name: "ATP", flag: "🎾" },
  { id: "wta", name: "WTA", flag: "🎾" },
];

const TEXTS: Record<string, Record<string, string>> = {
  fr: {
    hero_tag: "STATISTIQUES SPORTIVES",
    hero_title: "Classements & Statistiques",
    hero_subtitle: "Données en direct issues d'ESPN. Classements, meilleurs buteurs, leaders statistiques et plus encore.",
    loading: "Chargement...",
    error: "Erreur de chargement. Réessayez.",
    tab_standings: "📊 Classements",
    tab_leaders: "🏆 Leaders",
    tab_schedule: "📅 Calendrier",
    tab_injuries: "🏥 Blessures",
    pos: "#", team: "Équipe", played: "MJ", wins: "V", draws: "N", losses: "D",
    gf: "BP", ga: "BC", gd: "Diff", points: "Pts",
    w: "V", l: "D", pct: "%", streak: "Série",
    rank: "#", player: "Joueur", pts: "Points", value: "Stat",
    no_data: "Aucune donnée disponible",
    no_upcoming: "Aucun match à venir",
    no_injuries: "Blessures indisponibles pour ce sport",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    updated: "Mis à jour toutes les 30 min via ESPN",
  },
  en: {
    hero_tag: "SPORTS STATISTICS",
    hero_title: "Standings & Statistics",
    hero_subtitle: "Live data from ESPN. Standings, top scorers, stat leaders and more.",
    loading: "Loading...",
    error: "Failed to load. Try again.",
    tab_standings: "📊 Standings",
    tab_leaders: "🏆 Leaders",
    tab_schedule: "📅 Schedule",
    tab_injuries: "🏥 Injuries",
    pos: "#", team: "Team", played: "GP", wins: "W", draws: "D", losses: "L",
    gf: "GF", ga: "GA", gd: "GD", points: "Pts",
    w: "W", l: "L", pct: "%", streak: "Streak",
    rank: "#", player: "Player", pts: "Points", value: "Stat",
    no_data: "No data available",
    no_upcoming: "No upcoming matches",
    no_injuries: "Injuries not available for this sport",
    today: "Today",
    tomorrow: "Tomorrow",
    updated: "Updated every 30 min via ESPN",
  },
  es: {
    hero_tag: "ESTADÍSTICAS DEPORTIVAS",
    hero_title: "Clasificaciones & Estadísticas",
    hero_subtitle: "Datos en vivo de ESPN. Clasificaciones, goleadores, líderes estadísticos y más.",
    loading: "Cargando...",
    error: "Error al cargar. Inténtalo de nuevo.",
    tab_standings: "📊 Clasificaciones",
    tab_leaders: "🏆 Líderes",
    tab_schedule: "📅 Calendario",
    tab_injuries: "🏥 Lesiones",
    pos: "#", team: "Equipo", played: "PJ", wins: "V", draws: "E", losses: "D",
    gf: "GF", ga: "GC", gd: "Dif", points: "Pts",
    w: "V", l: "D", pct: "%", streak: "Racha",
    rank: "#", player: "Jugador", pts: "Puntos", value: "Stat",
    no_data: "Sin datos disponibles",
    no_upcoming: "No hay partidos próximos",
    no_injuries: "Lesiones no disponibles para este deporte",
    today: "Hoy",
    tomorrow: "Mañana",
    updated: "Actualizado cada 30 min vía ESPN",
  },
};

export default function StatsSportsPage() {
  const locale = useLocale();
  const t = TEXTS[locale] || TEXTS.fr;

  const [activeSport, setActiveSport] = useState("football");
  const [activeLeague, setActiveLeague] = useState("fra.1");
  const [activeTour, setActiveTour] = useState("atp");
  const [activeView, setActiveView] = useState<"standings" | "leaders" | "schedule" | "injuries">("standings");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sportOpen, setSportOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const sportRef = useRef<HTMLDivElement>(null);
  const leagueRef = useRef<HTMLDivElement>(null);
  const tourRef = useRef<HTMLDivElement>(null);

  const currentSport = SPORTS.find((s) => s.id === activeSport);
  const currentLeague = FOOTBALL_LEAGUES.find((l) => l.id === activeLeague);
  const currentTour = TENNIS_TOURS.find((t) => t.id === activeTour);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sportRef.current && !sportRef.current.contains(e.target as Node)) setSportOpen(false);
      if (leagueRef.current && !leagueRef.current.contains(e.target as Node)) setLeagueOpen(false);
      if (tourRef.current && !tourRef.current.contains(e.target as Node)) setTourOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      setData(null);

      let url = `/api/stats-sports?sport=${activeSport}&view=${activeView}`;
      if (activeSport === "football") url += `&league=${activeLeague}`;
      if (activeSport === "tennis") url += `&league=${activeTour}`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("fail");
        const json = await res.json();
        setData(json);
      } catch {
        setError(true);
      }
      setLoading(false);
    }
    load();
  }, [activeSport, activeLeague, activeTour, activeView]);

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">📊 {t.hero_tag}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{t.hero_title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/40">{t.hero_subtitle}</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Sport + League selectors */}
        <div className="flex items-center justify-center gap-3">
          {/* Sport dropdown */}
          <div className="relative" ref={sportRef}>
            <button
              onClick={() => { setSportOpen(!sportOpen); setLeagueOpen(false); setTourOpen(false); }}
              className="flex items-center gap-2 cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none transition hover:border-neutral-300"
            >
              <span>{currentSport?.label}</span>
              <svg className={`h-3.5 w-3.5 transition-transform ${sportOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {sportOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    onClick={() => {
                      setActiveSport(sport.id);
                      setActiveView("standings");
                      if (sport.id === "football") setActiveLeague("fra.1");
                      if (sport.id === "tennis") setActiveTour("atp");
                      setSportOpen(false);
                    }}
                    className={`flex w-full items-center px-4 py-2.5 text-sm font-medium transition hover:bg-emerald-50 ${activeSport === sport.id ? "bg-emerald-50 text-emerald-600 font-semibold" : "text-neutral-700"}`}
                  >
                    {sport.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* League dropdown (football) */}
          {activeSport === "football" && (
            <div className="relative" ref={leagueRef}>
              <button
                onClick={() => { setLeagueOpen(!leagueOpen); setSportOpen(false); setTourOpen(false); }}
                className="flex items-center gap-2 cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none transition hover:border-neutral-300"
              >
                {currentLeague && <img src={currentLeague.flag} alt="" className="h-4 w-5 rounded-sm object-cover" />}
                <span>{currentLeague?.name}</span>
                <svg className={`h-3.5 w-3.5 transition-transform ${leagueOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {leagueOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 max-h-[300px] min-w-[220px] overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
                  {FOOTBALL_LEAGUES.map((league) => (
                    <button
                      key={league.id}
                      onClick={() => { setActiveLeague(league.id); setLeagueOpen(false); }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition hover:bg-emerald-50 ${activeLeague === league.id ? "bg-emerald-50 text-emerald-600 font-semibold" : "text-neutral-700"}`}
                    >
                      <img src={league.flag} alt="" className="h-4 w-5 rounded-sm object-cover" />
                      <span>{league.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tour dropdown (tennis) */}
          {activeSport === "tennis" && (
            <div className="relative" ref={tourRef}>
              <button
                onClick={() => { setTourOpen(!tourOpen); setSportOpen(false); setLeagueOpen(false); }}
                className="flex items-center gap-2 cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none transition hover:border-neutral-300"
              >
                <span>{currentTour?.name}</span>
                <svg className={`h-3.5 w-3.5 transition-transform ${tourOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {tourOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                  {TENNIS_TOURS.map((tour) => (
                    <button
                      key={tour.id}
                      onClick={() => { setActiveTour(tour.id); setTourOpen(false); }}
                      className={`flex w-full items-center px-4 py-2.5 text-sm font-medium transition hover:bg-emerald-50 ${activeTour === tour.id ? "bg-emerald-50 text-emerald-600 font-semibold" : "text-neutral-700"}`}
                    >
                      {tour.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* View toggle: Standings / Leaders / Schedule / Injuries */}
        {(currentSport?.hasLeaders || currentSport?.hasSchedule || currentSport?.hasInjuries) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1">
            <button
              onClick={() => setActiveView("standings")}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeView === "standings"
                  ? "bg-neutral-900 text-white shadow"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              }`}
            >
              {t.tab_standings}
            </button>
            {currentSport?.hasLeaders && (
              <button
                onClick={() => setActiveView("leaders")}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeView === "leaders"
                    ? "bg-neutral-900 text-white shadow"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                }`}
              >
                {t.tab_leaders}
              </button>
            )}
            {currentSport?.hasSchedule && (
              <button
                onClick={() => setActiveView("schedule")}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeView === "schedule"
                    ? "bg-neutral-900 text-white shadow"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                }`}
              >
                {t.tab_schedule}
              </button>
            )}
            {currentSport?.hasInjuries && (
              <button
                onClick={() => setActiveView("injuries")}
                className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeView === "injuries"
                    ? "bg-neutral-900 text-white shadow"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                }`}
              >
                {t.tab_injuries}
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-neutral-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <span className="text-sm">{t.loading}</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-red-500">{t.error}</p>
            </div>
          ) : data?.view === "leaders" ? (
            <LeadersView data={data} t={t} />
          ) : data?.view === "schedule" ? (
            <ScheduleView data={data} t={t} locale={locale} />
          ) : data?.view === "injuries" ? (
            <InjuriesView data={data} t={t} />
          ) : data?.sport === "football" ? (
            <FootballTable data={data} t={t} />
          ) : data?.sport === "tennis" ? (
            <TennisTable data={data} t={t} />
          ) : data?.conferences ? (
            <USTable data={data} t={t} />
          ) : null}
        </div>

        <p className="mt-6 pb-8 text-center text-[11px] text-neutral-400">{t.updated}</p>
      </div>
    </main>
  );
}

// ── Leaders view (works for all sports) ──
function LeadersView({ data, t }: { data: any; t: Record<string, string> }) {
  const categories = data?.categories || [];
  if (categories.length === 0) return <p className="text-center text-neutral-400 py-10">{t.no_data}</p>;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {categories.map((cat: any, ci: number) => (
        <div key={ci} className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="bg-neutral-900 px-4 py-3">
            <h3 className="text-sm font-bold text-white">{cat.name}</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {cat.leaders.map((leader: any, li: number) => {
              // Build info string: "Esteban Lepaul — REN (3 assists)"
              const extraInfo = leader.subtitle?.replace(/^\d+\s*matchs?\s*·?\s*/, "").trim() || "";
              return (
                <div key={li} className={`flex items-center gap-2.5 px-3 py-2.5 ${li === 0 ? "bg-amber-50/40" : ""}`}>
                  <span className="w-5 shrink-0 text-xs font-bold text-neutral-400 text-center">{leader.rank}</span>
                  <HeadshotWithFallback headshot={leader.headshot} teamLogo={leader.team?.logo} name={leader.name} />
                  <p className="flex-1 min-w-0 text-xs font-bold text-neutral-900 truncate">
                    {leader.name}
                    {leader.team?.shortName ? ` — ${leader.team.shortName}` : ""}
                    {extraInfo ? ` (${extraInfo})` : ""}
                  </p>
                  {leader.subtitle && (() => {
                    const m = leader.subtitle.match(/^(\d+)/);
                    return m ? <span className="shrink-0 text-xs font-bold text-neutral-500">{m[1]}</span> : null;
                  })()}
                  <span className="shrink-0 text-sm font-extrabold text-emerald-600">{leader.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Headshot with team logo fallback ──
function HeadshotWithFallback({ headshot, teamLogo, name }: { headshot: string | null; teamLogo: string | null; name: string }) {
  const [imgError, setImgError] = useState(false);

  if (headshot && !imgError) {
    return (
      <img
        src={headshot}
        alt=""
        className="h-8 w-8 rounded-full object-cover bg-neutral-100"
        onError={() => setImgError(true)}
      />
    );
  }

  if (teamLogo) {
    return <img src={teamLogo} alt="" className="h-7 w-7 object-contain" />;
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-500">
      {name?.charAt(0) || "?"}
    </div>
  );
}

// ── Form badges component ──
function FormBadges({ form, size = "sm" }: { form: string; size?: "sm" | "xs" }) {
  if (!form) return null;
  const colors: Record<string, string> = {
    W: "bg-emerald-500",
    D: "bg-amber-400",
    L: "bg-red-500",
  };
  const sizeClass = size === "xs" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  const textSize = size === "xs" ? "text-[7px]" : "text-[8px]";
  return (
    <div className="flex gap-0.5">
      {form.split("").slice(0, 5).map((r, i) => (
        <span
          key={i}
          className={`${sizeClass} ${colors[r] || "bg-neutral-300"} inline-flex items-center justify-center rounded-full ${textSize} font-bold text-white`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

// ── Football standings table ──
function FootballTable({ data, t }: { data: any; t: Record<string, string> }) {
  const standings = data?.standings || [];
  if (standings.length === 0) return <p className="text-center text-neutral-400 py-10">{t.no_data}</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-900 text-white">
            <th className="py-3 pl-3 pr-1 text-left text-xs font-semibold w-8">{t.pos}</th>
            <th className="py-3 px-2 text-left text-xs font-semibold">{t.team}</th>
            <th className="py-3 px-2 text-center text-xs font-semibold hidden sm:table-cell">{t.played}</th>
            <th className="py-3 px-2 text-center text-xs font-semibold">{t.wins}</th>
            <th className="py-3 px-2 text-center text-xs font-semibold">{t.draws}</th>
            <th className="py-3 px-2 text-center text-xs font-semibold">{t.losses}</th>
            <th className="py-3 px-2 text-center text-xs font-semibold hidden sm:table-cell">{t.gf}</th>
            <th className="py-3 px-2 text-center text-xs font-semibold hidden sm:table-cell">{t.ga}</th>
            <th className="py-3 px-2 text-center text-xs font-semibold">{t.gd}</th>
            <th className="py-3 px-1 text-center text-xs font-semibold hidden md:table-cell">Forme</th>
            <th className="py-3 px-2 pr-3 text-center text-xs font-bold">{t.points}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row: any, i: number) => (
            <tr
              key={i}
              className={`border-t border-neutral-100 transition hover:bg-emerald-50/50 ${
                i < 4 ? "bg-emerald-50/30" : i >= standings.length - 3 ? "bg-red-50/30" : ""
              }`}
            >
              <td className="py-2.5 pl-3 pr-1 text-xs font-bold text-neutral-500">{row.position}</td>
              <td className="py-2.5 px-2">
                <div className="flex items-center gap-2">
                  {row.team.logo && <img src={row.team.logo} alt="" className="h-5 w-5 object-contain" />}
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-neutral-900 truncate block max-w-[120px] sm:max-w-none">{row.team.name}</span>
                    {/* Form badges — mobile only (under team name) */}
                    {row.form && (
                      <div className="mt-0.5 md:hidden">
                        <FormBadges form={row.form} size="xs" />
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-2.5 px-2 text-center text-xs text-neutral-500 hidden sm:table-cell">{row.played}</td>
              <td className="py-2.5 px-2 text-center text-xs font-medium text-emerald-600">{row.wins}</td>
              <td className="py-2.5 px-2 text-center text-xs text-neutral-500">{row.draws}</td>
              <td className="py-2.5 px-2 text-center text-xs text-red-500">{row.losses}</td>
              <td className="py-2.5 px-2 text-center text-xs text-neutral-500 hidden sm:table-cell">{row.goalsFor}</td>
              <td className="py-2.5 px-2 text-center text-xs text-neutral-500 hidden sm:table-cell">{row.goalsAgainst}</td>
              <td className="py-2.5 px-2 text-center text-xs font-medium">
                <span className={row.goalDiff > 0 ? "text-emerald-600" : row.goalDiff < 0 ? "text-red-500" : "text-neutral-400"}>
                  {row.goalDiff > 0 ? "+" : ""}{row.goalDiff}
                </span>
              </td>
              {/* Form badges — desktop only (own column) */}
              <td className="py-2.5 px-1 hidden md:table-cell">
                <div className="flex justify-center">
                  <FormBadges form={row.form} />
                </div>
              </td>
              <td className="py-2.5 px-2 pr-3 text-center text-sm font-extrabold text-neutral-900">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── US Sports standings table ──
function USTable({ data, t }: { data: any; t: Record<string, string> }) {
  const conferences = data?.conferences || [];
  if (conferences.length === 0) return <p className="text-center text-neutral-400 py-10">{t.no_data}</p>;

  return (
    <div className="space-y-6">
      {conferences.map((conf: any, ci: number) => (
        <div key={ci}>
          <h3 className="mb-3 text-sm font-bold text-neutral-900">{conf.name}</h3>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-900 text-white">
                  <th className="py-3 pl-3 pr-1 text-left text-xs font-semibold w-8">{t.pos}</th>
                  <th className="py-3 px-2 text-left text-xs font-semibold">{t.team}</th>
                  <th className="py-3 px-2 text-center text-xs font-semibold">{t.played}</th>
                  <th className="py-3 px-2 text-center text-xs font-semibold">{t.w}</th>
                  <th className="py-3 px-2 text-center text-xs font-semibold">{t.l}</th>
                  <th className="py-3 px-2 text-center text-xs font-semibold">{t.pct}</th>
                  <th className="py-3 px-2 pr-3 text-center text-xs font-semibold">{t.streak}</th>
                </tr>
              </thead>
              <tbody>
                {conf.entries.map((row: any, i: number) => (
                  <tr key={i} className="border-t border-neutral-100 transition hover:bg-emerald-50/50">
                    <td className="py-2.5 pl-3 pr-1 text-xs font-bold text-neutral-500">{i + 1}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        {row.team.logo && <img src={row.team.logo} alt="" className="h-5 w-5 object-contain" />}
                        <span className="text-xs font-semibold text-neutral-900 truncate max-w-[140px] sm:max-w-none">{row.team.name}</span>
                        {row.division && <span className="hidden sm:inline text-[10px] text-neutral-400">{row.division}</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-xs text-neutral-500">{row.played ?? (row.wins + row.losses)}</td>
                    <td className="py-2.5 px-2 text-center text-xs font-medium text-emerald-600">{row.wins}</td>
                    <td className="py-2.5 px-2 text-center text-xs text-red-500">{row.losses}</td>
                    <td className="py-2.5 px-2 text-center text-xs text-neutral-600">{row.pct}</td>
                    <td className="py-2.5 px-2 pr-3 text-center text-xs text-neutral-500">{row.streak}</td>
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

// ── Tennis rankings table ──
function TennisTable({ data, t }: { data: any; t: Record<string, string> }) {
  const rankings = data?.rankings || [];
  if (rankings.length === 0) return <p className="text-center text-neutral-400 py-10">{t.no_data}</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-900 text-white">
            <th className="py-3 pl-3 pr-1 text-left text-xs font-semibold w-8">{t.rank}</th>
            <th className="py-3 px-2 text-left text-xs font-semibold">{t.player}</th>
            <th className="py-3 px-2 pr-3 text-center text-xs font-bold">{t.pts}</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((row: any, i: number) => {
            const diff = row.previousRank - row.rank;
            return (
              <tr key={i} className={`border-t border-neutral-100 transition hover:bg-emerald-50/50 ${i < 10 ? "bg-amber-50/30" : ""}`}>
                <td className="py-2.5 pl-3 pr-1 text-xs font-bold text-neutral-500">{row.rank}</td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <HeadshotWithFallback headshot={row.headshot} teamLogo={null} name={row.name} />
                    {row.countryFlag && <img src={row.countryFlag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />}
                    <span className="text-xs font-semibold text-neutral-900">{row.name}</span>
                    {diff !== 0 && (
                      <span className={`text-[10px] font-medium ${diff > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-2 pr-3 text-center text-sm font-extrabold text-neutral-900">
                  {typeof row.points === "number" ? row.points.toLocaleString() : row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
// ── Schedule helpers ──
function groupMatchesByDate(matches: any[], locale: string, t: Record<string, string>) {
  const groups: { label: string; matches: any[] }[] = [];
  const map = new Map<string, any[]>();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  for (const m of matches) {
    const dateStr = new Date(m.date).toISOString().slice(0, 10);
    let label = dateStr;
    if (dateStr === todayStr) label = t.today;
    else if (dateStr === tomorrowStr) label = t.tomorrow;
    else {
      const d = new Date(m.date);
      label = d.toLocaleDateString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", {
        weekday: "short", day: "numeric", month: "short",
      });
    }
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(m);
  }
  for (const [label, matches] of map) {
    groups.push({ label, matches });
  }
  return groups;
}

function formatMatchTime(dateStr: string, locale: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Schedule view ──
function ScheduleView({ data, t, locale }: { data: any; t: Record<string, string>; locale: string }) {
  const matches = data?.matches || [];
  if (matches.length === 0) return <p className="text-center text-neutral-400 py-10">{t.no_upcoming}</p>;

  const isTennis = data?.sport === "tennis";
  const grouped = groupMatchesByDate(matches, locale, t);

  return (
    <div className="space-y-6">
      {grouped.map((group, gi) => (
        <div key={gi}>
          <h3 className="mb-3 text-sm font-bold text-neutral-900 uppercase tracking-wide">{group.label}</h3>
          <div className="space-y-2">
            {group.matches.map((match: any, mi: number) => (
              <div
                key={match.id ?? mi}
                className="overflow-hidden rounded-xl border border-neutral-200 bg-white px-3 py-3 sm:px-4 transition hover:border-neutral-300"
              >
                {isTennis ? (
                  /* Tennis layout */
                  <div>
                    {match.tournament && (
                      <p className="text-[10px] text-neutral-400 mb-1.5">{match.tournament}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-1.5">
                        {match.players?.map((p: any, pi: number) => (
                          <div key={pi} className="flex items-center gap-2">
                            <HeadshotWithFallback headshot={p.headshot} teamLogo={null} name={p.name} />
                            {p.countryFlag && <img src={p.countryFlag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />}
                            <span className="text-xs font-semibold text-neutral-900">{p.name}</span>
                            {p.seed && <span className="text-[10px] text-neutral-400">[{p.seed}]</span>}
                          </div>
                        ))}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-emerald-600">{formatMatchTime(match.date, locale)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Football / US sport layout */
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Home */}
                    <div className="flex-1 flex items-center justify-end gap-2 text-right min-w-0">
                      <span className="text-xs font-semibold text-neutral-900 truncate hidden sm:inline">{match.home?.name}</span>
                      <span className="text-xs font-semibold text-neutral-900 truncate sm:hidden">{match.home?.shortName || match.home?.name}</span>
                      {match.home?.logo && <img src={match.home.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                    </div>

                    {/* Time */}
                    <div className="flex flex-col items-center shrink-0 min-w-[56px]">
                      <span className="text-sm font-bold text-emerald-600">{formatMatchTime(match.date, locale)}</span>
                      {match.venue && (
                        <span className="text-[9px] text-neutral-400 mt-0.5 hidden sm:block truncate max-w-[120px] text-center">{match.venue}</span>
                      )}
                      {match.broadcast && (
                        <span className="text-[9px] text-neutral-400">{match.broadcast}</span>
                      )}
                    </div>

                    {/* Away */}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      {match.away?.logo && <img src={match.away.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                      <span className="text-xs font-semibold text-neutral-900 truncate hidden sm:inline">{match.away?.name}</span>
                      <span className="text-xs font-semibold text-neutral-900 truncate sm:hidden">{match.away?.shortName || match.away?.name}</span>
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

// ── Injury status badge color ──
function injuryStatusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("out") || s.includes("injured reserve") || s.includes("ir")) return "bg-red-500 text-white";
  if (s.includes("doubtful")) return "bg-orange-500 text-white";
  if (s.includes("questionable")) return "bg-yellow-500 text-neutral-900";
  if (s.includes("day-to-day") || s.includes("dtd")) return "bg-amber-400 text-neutral-900";
  if (s.includes("probable")) return "bg-emerald-500 text-white";
  return "bg-neutral-400 text-white";
}

// ── Injuries view ──
function InjuriesView({ data, t }: { data: any; t: Record<string, string> }) {
  const teams = data?.teams || [];
  if (teams.length === 0) {
    const msg = data?.view === "injuries" ? t.no_injuries : t.no_data;
    return <p className="text-center text-neutral-400 py-10">{msg}</p>;
  }

  return (
    <div className="space-y-4">
      {teams.map((teamEntry: any, ti: number) => (
        <div key={ti} className="overflow-hidden rounded-xl border border-neutral-200">
          {/* Team header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-neutral-900 text-white">
            {teamEntry.team?.logo && <img src={teamEntry.team.logo} alt="" className="h-6 w-6 object-contain" />}
            <h3 className="text-sm font-bold">{teamEntry.team?.name}</h3>
            <span className="ml-auto text-[10px] font-medium bg-white/10 px-2 py-0.5 rounded-full">
              {teamEntry.injuries?.length ?? 0}
            </span>
          </div>

          {/* Injuries list */}
          <div className="divide-y divide-neutral-100">
            {teamEntry.injuries?.map((inj: any, ii: number) => (
              <div key={ii} className="flex items-start gap-2.5 px-3 py-2.5 sm:px-4">
                <HeadshotWithFallback headshot={inj.athlete?.headshot} teamLogo={teamEntry.team?.logo} name={inj.athlete?.name || "?"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-neutral-900">{inj.athlete?.name}</span>
                    {inj.athlete?.position && (
                      <span className="text-[10px] text-neutral-400">{inj.athlete.position}</span>
                    )}
                  </div>
                  {inj.description && (
                    <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{inj.description}</p>
                  )}
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${injuryStatusColor(inj.status)}`}>
                  {inj.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}