// src/app/api/world-cup/route.ts
// Coupe du Monde 2026 — 48 équipes, 12 groupes, 104 matchs
// Groupes codés en dur (tirage 5 déc 2025 + playoffs mars 2026)
// Calendrier via ESPN scoreboard fifa.world

import { NextResponse } from "next/server";

// ── Cache 30 min ──
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;
function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

async function fetchESPN(url: string) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ── 12 groupes — données définitives ──
// flag = code ISO 2 lettres pour flagcdn.com
const GROUPS = [
  {
    name: "A", teams: [
      { name: "Mexique", nameEn: "Mexico", flag: "mx" },
      { name: "Tchéquie", nameEn: "Czechia", flag: "cz" },
      { name: "Afrique du Sud", nameEn: "South Africa", flag: "za" },
      { name: "Corée du Sud", nameEn: "South Korea", flag: "kr" },
    ],
  },
  {
    name: "B", teams: [
      { name: "Canada", nameEn: "Canada", flag: "ca" },
      { name: "Bosnie-Herzégovine", nameEn: "Bosnia and Herzegovina", flag: "ba" },
      { name: "Qatar", nameEn: "Qatar", flag: "qa" },
      { name: "Suisse", nameEn: "Switzerland", flag: "ch" },
    ],
  },
  {
    name: "C", teams: [
      { name: "Brésil", nameEn: "Brazil", flag: "br" },
      { name: "Maroc", nameEn: "Morocco", flag: "ma" },
      { name: "Écosse", nameEn: "Scotland", flag: "gb-sct" },
      { name: "Haïti", nameEn: "Haiti", flag: "ht" },
    ],
  },
  {
    name: "D", teams: [
      { name: "États-Unis", nameEn: "United States", flag: "us" },
      { name: "Türkiye", nameEn: "Türkiye", flag: "tr" },
      { name: "Paraguay", nameEn: "Paraguay", flag: "py" },
      { name: "Australie", nameEn: "Australia", flag: "au" },
    ],
  },
  {
    name: "E", teams: [
      { name: "Allemagne", nameEn: "Germany", flag: "de" },
      { name: "Curaçao", nameEn: "Curaçao", flag: "cw" },
      { name: "Côte d'Ivoire", nameEn: "Ivory Coast", flag: "ci" },
      { name: "Équateur", nameEn: "Ecuador", flag: "ec" },
    ],
  },
  {
    name: "F", teams: [
      { name: "Pays-Bas", nameEn: "Netherlands", flag: "nl" },
      { name: "Suède", nameEn: "Sweden", flag: "se" },
      { name: "Japon", nameEn: "Japan", flag: "jp" },
      { name: "Tunisie", nameEn: "Tunisia", flag: "tn" },
    ],
  },
  {
    name: "G", teams: [
      { name: "Belgique", nameEn: "Belgium", flag: "be" },
      { name: "Égypte", nameEn: "Egypt", flag: "eg" },
      { name: "Iran", nameEn: "Iran", flag: "ir" },
      { name: "Nouvelle-Zélande", nameEn: "New Zealand", flag: "nz" },
    ],
  },
  {
    name: "H", teams: [
      { name: "Espagne", nameEn: "Spain", flag: "es" },
      { name: "Cap-Vert", nameEn: "Cape Verde", flag: "cv" },
      { name: "Arabie saoudite", nameEn: "Saudi Arabia", flag: "sa" },
      { name: "Uruguay", nameEn: "Uruguay", flag: "uy" },
    ],
  },
  {
    name: "I", teams: [
      { name: "France", nameEn: "France", flag: "fr" },
      { name: "Irak", nameEn: "Iraq", flag: "iq" },
      { name: "Sénégal", nameEn: "Senegal", flag: "sn" },
      { name: "Norvège", nameEn: "Norway", flag: "no" },
    ],
  },
  {
    name: "J", teams: [
      { name: "Argentine", nameEn: "Argentina", flag: "ar" },
      { name: "Algérie", nameEn: "Algeria", flag: "dz" },
      { name: "Autriche", nameEn: "Austria", flag: "at" },
      { name: "Jordanie", nameEn: "Jordan", flag: "jo" },
    ],
  },
  {
    name: "K", teams: [
      { name: "Portugal", nameEn: "Portugal", flag: "pt" },
      { name: "RD Congo", nameEn: "DR Congo", flag: "cd" },
      { name: "Ouzbékistan", nameEn: "Uzbekistan", flag: "uz" },
      { name: "Colombie", nameEn: "Colombia", flag: "co" },
    ],
  },
  {
    name: "L", teams: [
      { name: "Angleterre", nameEn: "England", flag: "gb-eng" },
      { name: "Croatie", nameEn: "Croatia", flag: "hr" },
      { name: "Ghana", nameEn: "Ghana", flag: "gh" },
      { name: "Panama", nameEn: "Panama", flag: "pa" },
    ],
  },
];

// ── Tournoi info ──
const TOURNAMENT_INFO = {
  name: "Coupe du Monde FIFA 2026",
  nameEn: "2026 FIFA World Cup",
  dates: "11 juin — 19 juillet 2026",
  datesEn: "June 11 — July 19, 2026",
  hosts: "USA, Canada, Mexique",
  teams: 48,
  groups: 12,
  matches: 104,
  stadiums: 16,
  finalVenue: "MetLife Stadium, East Rutherford, New Jersey",
};

// ── Schedule via ESPN ──
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchSchedule() {
  // Fetch all WC matches: June 11 → July 19 2026
  const from = "20260611";
  const to = "20260719";
  const data = await fetchESPN(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${from}-${to}&limit=200`
  );
  if (!data?.events) return [];

  return data.events.map((ev: any) => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
    const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
    return {
      id: ev.id,
      date: ev.date,
      name: ev.name ?? ev.shortName ?? "",
      status: ev.status?.type?.name ?? "STATUS_SCHEDULED",
      statusDetail: ev.status?.type?.shortDetail ?? "",
      completed: ev.status?.type?.completed ?? false,
      venue: comp?.venue?.fullName ?? null,
      city: comp?.venue?.address?.city ?? null,
      group: ev.season?.slug ?? comp?.series?.summary ?? null,
      home: home ? {
        name: home.team?.displayName ?? home.team?.name,
        shortName: home.team?.abbreviation,
        logo: home.team?.logos?.[0]?.href,
        score: home.score,
      } : null,
      away: away ? {
        name: away.team?.displayName ?? away.team?.name,
        shortName: away.team?.abbreviation,
        logo: away.team?.logos?.[0]?.href,
        score: away.score,
      } : null,
    };
  }).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ── Standings via ESPN (live pendant le tournoi) ──
async function fetchStandings() {
  const data = await fetchESPN(
    `https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings`
  );
  if (!data) return null;

  const children = data.children || [];
  const groups: any[] = [];

  for (const group of children) {
    const groupName = group.name || group.abbreviation || "";
    const entries = (group.standings?.entries || []).map((entry: any) => {
      const team = entry.team || {};
      const stats: Record<string, number> = {};
      for (const s of entry.stats || []) { stats[s.name] = s.value; }
      return {
        team: { name: team.displayName || team.name, logo: team.logos?.[0]?.href },
        played: stats.gamesPlayed || 0,
        wins: stats.wins || 0,
        draws: stats.ties || 0,
        losses: stats.losses || 0,
        goalsFor: stats.pointsFor || 0,
        goalsAgainst: stats.pointsAgainst || 0,
        goalDiff: stats.pointDifferential || 0,
        points: stats.points || 0,
      };
    });
    groups.push({ name: groupName, entries });
  }
  return groups.length > 0 ? groups : null;
}

// ── GET handler ──
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "groups";

  const cacheKey = `worldcup:${view}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    let result: any = null;

    if (view === "groups") {
      // Groupes en dur + tentative standings ESPN (live pendant le tournoi)
      const liveStandings = await fetchStandings();
      result = {
        view: "groups",
        info: TOURNAMENT_INFO,
        groups: GROUPS,
        liveStandings, // null avant le début du tournoi, rempli pendant
      };
    } else if (view === "schedule") {
      const matches = await fetchSchedule();
      result = {
        view: "schedule",
        info: TOURNAMENT_INFO,
        matches,
      };
    } else {
      return NextResponse.json({ error: "Invalid view" }, { status: 400 });
    }

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[world-cup] Error:", err.message);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}