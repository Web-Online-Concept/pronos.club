// src/app/[locale]/(public)/stats-sports/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";

// ── Config ──
const SPORTS = [
  { id: "football", label: "⚽ Football", hasLeagues: true, hasLeaders: true },
  { id: "nba", label: "🏀 NBA", hasLeaders: true },
  { id: "nhl", label: "🏒 NHL", hasLeaders: true },
  { id: "tennis", label: "🎾 Tennis" },
  { id: "nfl", label: "🏈 NFL", hasLeaders: true },
  { id: "mlb", label: "⚾ MLB", hasLeaders: true },
];

const FOOTBALL_LEAGUES = [
  { id: "fra.1", name: "Ligue 1", flag: "🇫🇷" },
  { id: "eng.1", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "esp.1", name: "La Liga", flag: "🇪🇸" },
  { id: "ita.1", name: "Serie A", flag: "🇮🇹" },
  { id: "ger.1", name: "Bundesliga", flag: "🇩🇪" },
  { id: "fra.2", name: "Ligue 2", flag: "🇫🇷" },
  { id: "por.1", name: "Liga Portugal", flag: "🇵🇹" },
  { id: "ned.1", name: "Eredivisie", flag: "🇳🇱" },
  { id: "bel.1", name: "Pro League", flag: "🇧🇪" },
  { id: "tur.1", name: "Süper Lig", flag: "🇹🇷" },
  { id: "uefa.champions", name: "Champions League", flag: "🏆" },
  { id: "uefa.europa", name: "Europa League", flag: "🏆" },
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
    pos: "#", team: "Équipe", played: "MJ", wins: "V", draws: "N", losses: "D",
    gf: "BP", ga: "BC", gd: "Diff", points: "Pts",
    w: "V", l: "D", pct: "%", streak: "Série",
    rank: "#", player: "Joueur", pts: "Points", value: "Stat",
    no_data: "Aucune donnée disponible",
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
    pos: "#", team: "Team", played: "GP", wins: "W", draws: "D", losses: "L",
    gf: "GF", ga: "GA", gd: "GD", points: "Pts",
    w: "W", l: "L", pct: "%", streak: "Streak",
    rank: "#", player: "Player", pts: "Points", value: "Stat",
    no_data: "No data available",
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
    pos: "#", team: "Equipo", played: "PJ", wins: "V", draws: "E", losses: "D",
    gf: "GF", ga: "GC", gd: "Dif", points: "Pts",
    w: "V", l: "D", pct: "%", streak: "Racha",
    rank: "#", player: "Jugador", pts: "Puntos", value: "Stat",
    no_data: "Sin datos disponibles",
    updated: "Actualizado cada 30 min vía ESPN",
  },
};

export default function StatsSportsPage() {
  const locale = useLocale();
  const t = TEXTS[locale] || TEXTS.fr;

  const [activeSport, setActiveSport] = useState("football");
  const [activeLeague, setActiveLeague] = useState("fra.1");
  const [activeTour, setActiveTour] = useState("atp");
  const [activeView, setActiveView] = useState<"standings" | "leaders">("standings");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const currentSport = SPORTS.find((s) => s.id === activeSport);

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
          <select
            value={activeSport}
            onChange={(e) => {
              setActiveSport(e.target.value);
              setActiveView("standings");
              if (e.target.value === "football") setActiveLeague("fra.1");
              if (e.target.value === "tennis") setActiveTour("atp");
            }}
            className="flex-1 sm:flex-none cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            {SPORTS.map((sport) => (
              <option key={sport.id} value={sport.id}>{sport.label}</option>
            ))}
          </select>

          {activeSport === "football" && (
            <select
              value={activeLeague}
              onChange={(e) => setActiveLeague(e.target.value)}
              className="flex-1 sm:flex-none cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              {FOOTBALL_LEAGUES.map((league) => (
                <option key={league.id} value={league.id}>{league.flag} {league.name}</option>
              ))}
            </select>
          )}

          {activeSport === "tennis" && (
            <select
              value={activeTour}
              onChange={(e) => setActiveTour(e.target.value)}
              className="flex-1 sm:flex-none cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              {TENNIS_TOURS.map((tour) => (
                <option key={tour.id} value={tour.id}>{tour.flag} {tour.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* View toggle: Standings / Leaders */}
        {currentSport?.hasLeaders && (
          <div className="mt-4 flex items-center justify-center gap-1">
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
                  <span className="text-xs font-semibold text-neutral-900 truncate max-w-[140px] sm:max-w-none">{row.team.name}</span>
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