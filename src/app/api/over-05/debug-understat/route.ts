// src/app/api/over-05/debug-understat/route.ts
//
// ROUTE DEBUG TEMPORAIRE : recupere le HTML brut d'Understat et renvoie
// les ~3000 premiers caracteres autour de "datesData" pour analyser le format.
//
// Usage :
//   GET /api/over-05/debug-understat?team=Marseille&year=2025
//
// Auth via header secret partagé (pas besoin d'etre logué)

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  // Auth simple : check le secret
  const secret = req.headers.get("x-internal-secret");
  if (secret !== (process.env.CRON_SECRET ?? "PronosClub2026CronAuto")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const team = searchParams.get("team") ?? "Marseille";
  const year = searchParams.get("year") ?? "2025";

  const url = `https://understat.com/team/${team}/${year}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const html = await res.text();

    // Trouver toutes les variables JS injectees
    const allVars: string[] = [];
    const varRegex = /var\s+(\w+)\s*=\s*JSON\.parse/g;
    let m;
    while ((m = varRegex.exec(html)) !== null) {
      allVars.push(m[1]);
    }

    // Tenter plusieurs patterns possibles pour datesData
    const patterns = [
      { name: "old: datesData = JSON.parse('...')", regex: /datesData\s*=\s*JSON\.parse\('([^']{0,200})/ },
      { name: "double quotes", regex: /datesData\s*=\s*JSON\.parse\("([^"]{0,200})/ },
      { name: "backticks", regex: /datesData\s*=\s*JSON\.parse\(`([^`]{0,200})/ },
      { name: "decodeURI variant", regex: /datesData\s*=\s*JSON\.parse\(decodeURI\(['"]([^'"]{0,200})/ },
      { name: "no var prefix", regex: /\bdatesData\b[^=]*=[^J]*JSON\.parse\(['"]?([^'")]{0,150})/ },
    ];

    const patternMatches: Record<string, string | null> = {};
    for (const p of patterns) {
      const match = html.match(p.regex);
      patternMatches[p.name] = match ? `MATCH (sample: ${match[1].substring(0, 100)}...)` : null;
    }

    // Extraire les 500 caracteres avant et apres "datesData" si trouvé
    const datesDataIdx = html.indexOf("datesData");
    let context = "datesData NOT FOUND in HTML";
    if (datesDataIdx !== -1) {
      const start = Math.max(0, datesDataIdx - 50);
      const end = Math.min(html.length, datesDataIdx + 500);
      context = html.substring(start, end);
    }

    return NextResponse.json({
      url,
      status: res.status,
      htmlLength: html.length,
      htmlStartsWith: html.substring(0, 200),
      allJSONParseVars: allVars,
      patternMatches,
      datesDataContext: context,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Fetch failed",
        details: err instanceof Error ? err.message : "Unknown",
        url,
      },
      { status: 500 }
    );
  }
}