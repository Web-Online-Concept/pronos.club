/**
 * ═══════════════════════════════════════════════════════════════════
 * DossierSections.tsx
 * ═══════════════════════════════════════════════════════════════════
 *
 * Composants visuels pour la page dossier d'un pick IA.
 * Server components (pas d'interactivite, juste de l'affichage).
 *
 * Sections :
 * - HeroPick : verdict, cote, edge
 * - EdgeMath : visualisation +EV (jauge + chiffres)
 * - BooksComparator : tableau des 6 books avec mise en avant best
 * - TeamFormCard : forme 5 derniers matchs (couleurs W/L/D)
 * - HeadToHead : H2H derniers face-a-face
 * - BoxscoreStats : stats equipes (cles selon sport)
 * - LineupsAndInjuries : compositions + blessures (foot only)
 * - IAReasoning : raisonnement Claude+GPT formate
 * ═══════════════════════════════════════════════════════════════════
 */

import type { DossierPickData, BookOddsSnapshot } from "@/lib/ai-picks-v2/dossier-builder";
import type { EspnEventSummary, EspnTeamForm } from "@/lib/ai-picks-v2/espn-client";


// ─── Helpers UI ───────────────────────────────────────────────────


const fmtDate = (iso: string, locale: string = "fr-FR"): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtTime = (iso: string, locale: string = "fr-FR"): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtPct = (n: number | null, decimals: number = 1): string => {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(decimals)}%`;
};

const fmtOdds = (n: number | null): string => {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
};


// ─── HeroPick — verdict en haut de page ──────────────────────────


export function HeroPick({ data }: { data: DossierPickData }) {
  const isHighEdge = data.edgePct !== null && data.edgePct >= 7;
  const tierLabel = isHighEdge
    ? "💎 EDGE PREMIUM"
    : data.edgePct !== null && data.edgePct >= 5
    ? "⭐ EDGE FORT"
    : "🎯 VALUE BET";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-950 via-black to-violet-900 border border-violet-800/40 p-8 shadow-2xl">
      {/* Ribbon AI */}
      <div className="absolute top-4 right-4 px-3 py-1 bg-violet-700/40 backdrop-blur border border-violet-500/40 rounded-full text-xs font-bold text-violet-200 tracking-wider">
        🤖 INTELLIGENCE ARTIFICIELLE
      </div>

      {/* Tier badge */}
      <div className="mb-2">
        <span className="inline-block px-3 py-1 bg-violet-600/30 text-violet-200 text-xs font-bold rounded-full tracking-wider">
          {tierLabel}
        </span>
      </div>

      {/* Match */}
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
        {data.eventName}
      </h1>
      <p className="text-white/60 text-sm mb-6">
        {data.league} • {fmtDate(data.eventDate)} à {fmtTime(data.eventDate)}
      </p>

      {/* Pick + cote en grand */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
            Notre sélection
          </div>
          <div className="text-2xl font-bold text-white">{data.selection}</div>
          <div className="text-sm text-white/60 mt-1">
            Marché : {data.market.replace(/_/g, " ").toLowerCase()}
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-xl p-5 text-center">
          <div className="text-xs text-violet-200 uppercase tracking-wider mb-1">
            Cote {data.bookmaker}
          </div>
          <div className="text-4xl font-black text-white">
            {fmtOdds(data.odds)}
          </div>
          <div className="text-xs text-violet-200 mt-2">1U flat = 10€</div>
        </div>
      </div>

      {/* Edge en chiffres */}
      {data.edgePct !== null && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="text-4xl">📈</div>
          <div className="flex-1">
            <div className="text-emerald-300 font-bold text-lg">
              Value bet détectée : edge +{data.edgePct.toFixed(2)}%
            </div>
            <div className="text-emerald-200/70 text-sm mt-1">
              Cote {fmtOdds(data.odds)} sur {data.bookmaker} alors que la cote
              juste (no-vig Pinnacle) est {fmtOdds(data.fairOdds)}.
              C&apos;est mathématiquement +EV sur la durée.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── EdgeMath — visualisation mathematique du value bet ──────────


export function EdgeMathSection({ data }: { data: DossierPickData }) {
  if (
    data.fairOdds === null ||
    data.fairProbability === null ||
    data.bestSoftOdds === null
  ) {
    return null;
  }

  const fairPct = data.fairProbability * 100;
  const impliedFromBook = (1 / data.bestSoftOdds) * 100;
  const edgePct = data.edgePct ?? 0;
  // Returns sur 100€ mises a long terme : (cote_book - 1) * fairProb - (1 - fairProb)
  const expectedReturnPer100 =
    ((data.bestSoftOdds - 1) * data.fairProbability -
      (1 - data.fairProbability)) *
    100;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🧮</div>
        <h2 className="text-xl font-bold text-white">
          Pourquoi c&apos;est un Value Bet
        </h2>
      </div>

      <p className="text-white/70 text-sm mb-6 leading-relaxed">
        On utilise la méthode standard du value betting : on dévigge la cote du
        sharp book (Pinnacle) pour obtenir la <strong>vraie probabilité</strong>{" "}
        de l&apos;événement, puis on cherche un soft book qui paie mieux que cette
        probabilité fair. La différence = ton edge mathématique.
      </p>

      {/* Stats cles en 4 cartes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Cote Pinnacle (sharp)"
          value={fmtOdds(data.pinnacleRawOdds)}
          subtitle="Avant dévig"
        />
        <StatCard
          label="Cote juste (no-vig)"
          value={fmtOdds(data.fairOdds)}
          subtitle={`Probabilité ${fmtPct(fairPct, 1)}`}
        />
        <StatCard
          label="Notre cote"
          value={fmtOdds(data.bestSoftOdds)}
          subtitle={`Sur ${data.bestSoftBookName}`}
          highlight
        />
        <StatCard
          label="Edge"
          value={`+${edgePct.toFixed(2)}%`}
          subtitle="Avantage long terme"
          accent="emerald"
        />
      </div>

      {/* Visualisation jauge edge */}
      <EdgeGauge edgePct={edgePct} />

      {/* Calcul ROI */}
      <div className="mt-6 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
        <div className="text-sm text-white/60 mb-1">
          Espérance mathématique sur 100€ misés
        </div>
        <div className="text-2xl font-bold text-emerald-300">
          +{expectedReturnPer100.toFixed(2)}€
        </div>
        <div className="text-xs text-white/50 mt-1">
          Sur la durée, ce pick rapporte en moyenne{" "}
          {expectedReturnPer100.toFixed(2)}€ par tranche de 100€ misés. La
          variance court terme reste importante : 1U flat (10€) = mise
          recommandée.
        </div>
      </div>
    </section>
  );
}


function StatCard({
  label,
  value,
  subtitle,
  highlight = false,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
  accent?: "emerald" | "violet";
}) {
  const valueClass = accent === "emerald"
    ? "text-emerald-300"
    : highlight
    ? "text-violet-300"
    : "text-white";
  return (
    <div
      className={`rounded-lg p-3 border ${
        highlight
          ? "bg-violet-600/10 border-violet-500/30"
          : "bg-zinc-900 border-zinc-800"
      }`}
    >
      <div className="text-xs text-white/50 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-xl font-bold ${valueClass}`}>{value}</div>
      {subtitle && <div className="text-xs text-white/40 mt-1">{subtitle}</div>}
    </div>
  );
}


function EdgeGauge({ edgePct }: { edgePct: number }) {
  const max = 15; // edge "max" raisonnable affiche
  const filled = Math.min(100, (edgePct / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-white/50 mb-2">
        <span>Edge mathématique</span>
        <span className="text-white/80 font-bold">+{edgePct.toFixed(2)}%</span>
      </div>
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 rounded-full"
          style={{ width: `${filled}%` }}
        />
        {/* Tickmarks */}
        <div className="absolute inset-0 flex items-center">
          {[3, 5, 7, 10].map((t) => (
            <div
              key={t}
              className="absolute h-full w-px bg-white/20"
              style={{ left: `${(t / max) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-white/40 mt-1">
        <span>0%</span>
        <span>3% (seuil)</span>
        <span>5%</span>
        <span>7% (premium)</span>
        <span>10%+</span>
      </div>
    </div>
  );
}


// ─── BooksComparator — tableau des 6 books ────────────────────────


export function BooksComparator({ data }: { data: DossierPickData }) {
  if (!data.booksSnapshot || data.booksSnapshot.length === 0) return null;

  const sortedBooks = [...data.booksSnapshot].sort((a, b) => {
    if (a.odds === null && b.odds === null) return 0;
    if (a.odds === null) return 1;
    if (b.odds === null) return -1;
    return b.odds - a.odds;
  });

  const bestKey = data.bestSoftBookName;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">📊</div>
        <h2 className="text-xl font-bold text-white">
          Comparateur Bookmakers
        </h2>
      </div>

      <p className="text-white/60 text-sm mb-5">
        Chez quel bookmaker placer ce pari ?{" "}
        <span className="text-emerald-300 font-semibold">
          {bestKey ?? "Le mieux"}
        </span>{" "}
        offre la cote la plus généreuse à l&apos;instant T.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 pr-4">Bookmaker</th>
              <th className="pb-3 pr-4">Cote</th>
              <th className="pb-3">Gain pour 10€</th>
            </tr>
          </thead>
          <tbody>
            {sortedBooks.map((book, idx) => {
              const isBest = book.name === bestKey;
              const isMissing = book.odds === null;
              const gain = book.odds !== null ? (book.odds * 10).toFixed(2) : "—";
              return (
                <tr
                  key={book.key}
                  className={`border-b border-zinc-900 ${
                    isBest
                      ? "bg-emerald-500/10"
                      : isMissing
                      ? "opacity-40"
                      : ""
                  }`}
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium text-white">{book.name}</span>
                    {isBest && (
                      <span className="ml-2 px-2 py-0.5 bg-emerald-500/30 text-emerald-200 text-[10px] font-bold rounded-full">
                        MEILLEURE COTE
                      </span>
                    )}
                    {idx === 1 && !isBest && (
                      <span className="ml-2 text-[10px] text-white/40">2e</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {isMissing ? (
                      <span className="text-white/30">non coté</span>
                    ) : (
                      <span
                        className={
                          isBest
                            ? "text-emerald-300 font-bold text-lg"
                            : "text-white"
                        }
                      >
                        {fmtOdds(book.odds)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-white/70">
                    {isMissing ? "—" : `${gain}€`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}


// ─── TeamFormCard — forme 5 derniers matchs (utilise ESPN) ───────


export function TeamFormSection({
  homeForm,
  awayForm,
  homeTeam,
  awayTeam,
}: {
  homeForm: EspnTeamForm | null;
  awayForm: EspnTeamForm | null;
  homeTeam: string;
  awayTeam: string;
}) {
  if (!homeForm && !awayForm) return null;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">📈</div>
        <h2 className="text-xl font-bold text-white">Forme actuelle</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormCard form={homeForm} fallbackName={homeTeam} side="home" />
        <FormCard form={awayForm} fallbackName={awayTeam} side="away" />
      </div>
    </section>
  );
}


function FormCard({
  form,
  fallbackName,
  side,
}: {
  form: EspnTeamForm | null;
  fallbackName: string;
  side: "home" | "away";
}) {
  const sideLabel = side === "home" ? "🏠 Domicile" : "✈️ Extérieur";

  if (!form) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
        <div className="text-xs text-white/50 mb-1">{sideLabel}</div>
        <div className="text-lg font-bold text-white">{fallbackName}</div>
        <div className="text-xs text-white/40 mt-3">
          Forme non disponible pour cette équipe
        </div>
      </div>
    );
  }

  const wins = form.recentGames.filter((g) => g.result === "W").length;
  const losses = form.recentGames.filter((g) => g.result === "L").length;
  const draws = form.recentGames.filter((g) => g.result === "D").length;
  const total = form.recentGames.length;

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <div className="text-xs text-white/50 mb-1">{sideLabel}</div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-lg font-bold text-white truncate">
          {form.teamName}
        </div>
        {form.record && (
          <div className="text-xs text-white/60 font-mono">{form.record}</div>
        )}
      </div>

      {/* Mini badges W/L/D */}
      {total > 0 && (
        <div className="flex gap-1.5 mb-3">
          {form.recentGames.map((g, i) => {
            const color =
              g.result === "W"
                ? "bg-emerald-500"
                : g.result === "L"
                ? "bg-red-500"
                : g.result === "D"
                ? "bg-amber-500"
                : "bg-zinc-700";
            return (
              <div
                key={i}
                className={`flex-1 h-7 rounded ${color} text-white text-xs font-bold flex items-center justify-center`}
                title={`${g.result} ${g.score?.team ?? "?"}-${
                  g.score?.opponent ?? "?"
                } vs ${g.opponent}`}
              >
                {g.result ?? "—"}
              </div>
            );
          })}
        </div>
      )}

      {/* Compteur W/D/L */}
      {total > 0 && (
        <div className="flex justify-between text-xs mb-3">
          <span className="text-emerald-300 font-bold">{wins}V</span>
          {draws > 0 && (
            <span className="text-amber-300 font-bold">{draws}N</span>
          )}
          <span className="text-red-300 font-bold">{losses}D</span>
          <span className="text-white/40">sur {total}</span>
        </div>
      )}

      {/* Liste des derniers matchs */}
      <div className="space-y-1.5">
        {form.recentGames.slice(0, 5).map((g, i) => {
          const dateStr = new Date(g.date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
          });
          const dot =
            g.result === "W"
              ? "bg-emerald-500"
              : g.result === "L"
              ? "bg-red-500"
              : g.result === "D"
              ? "bg-amber-500"
              : "bg-zinc-600";
          return (
            <div
              key={i}
              className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-800/50"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
                <span className="text-white/40 font-mono">{dateStr}</span>
                <span className="text-white/70 truncate">
                  {g.isHome ? "vs" : "@"} {g.opponent}
                </span>
              </div>
              {g.score && (
                <span className="text-white/80 font-mono ml-2">
                  {g.score.team}-{g.score.opponent}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── BoxscoreStats — stats avancees ESPN ──────────────────────────


export function BoxscoreSection({
  summary,
}: {
  summary: EspnEventSummary | null;
}) {
  if (!summary) return null;
  if (summary.boxscore.home.length === 0 && summary.boxscore.away.length === 0) {
    return null;
  }

  // On affiche jusqu'a 8 stats les plus importantes
  const homeStats = summary.boxscore.home.slice(0, 8);
  const awayStats = summary.boxscore.away.slice(0, 8);
  const len = Math.max(homeStats.length, awayStats.length);

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">📊</div>
        <h2 className="text-xl font-bold text-white">Stats avancées</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 text-right pr-4">
                {summary.homeTeam.shortDisplayName}
              </th>
              <th className="pb-3 text-center">Stat</th>
              <th className="pb-3 text-left pl-4">
                {summary.awayTeam.shortDisplayName}
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: len }).map((_, i) => {
              const h = homeStats[i];
              const a = awayStats[i];
              const label = h?.label ?? a?.label ?? "";
              return (
                <tr key={i} className="border-b border-zinc-900">
                  <td className="py-2 text-right pr-4 text-white font-mono">
                    {h?.value ?? "—"}
                  </td>
                  <td className="py-2 text-center text-white/50 text-xs">
                    {label}
                  </td>
                  <td className="py-2 text-left pl-4 text-white font-mono">
                    {a?.value ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}


// ─── Records / Classement ─────────────────────────────────────────


export function RecordsSection({
  summary,
}: {
  summary: EspnEventSummary | null;
}) {
  if (!summary || !summary.records) return null;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🏆</div>
        <h2 className="text-xl font-bold text-white">Bilan saison</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <div className="text-xs text-white/50 uppercase mb-2">
            {summary.homeTeam.displayName}
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {summary.records.home || "—"}
          </div>
          <div className="text-xs text-white/40 mt-1">à domicile</div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <div className="text-xs text-white/50 uppercase mb-2">
            {summary.awayTeam.displayName}
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {summary.records.away || "—"}
          </div>
          <div className="text-xs text-white/40 mt-1">à l&apos;extérieur</div>
        </div>
      </div>

      {summary.venue && (
        <div className="mt-4 text-center text-xs text-white/40">
          📍 {summary.venue}
        </div>
      )}
    </section>
  );
}


// ─── Lineups + Injuries (foot uniquement, via API-Football) ──────


export function LineupsAndInjuries({
  apiFootballContext,
}: {
  apiFootballContext: DossierPickData["apiFootballContext"];
}) {
  if (!apiFootballContext) return null;

  const lineups = apiFootballContext.lineups ?? [];
  const injuries = apiFootballContext.injuries ?? [];

  if (lineups.length === 0 && injuries.length === 0) return null;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">⚕️</div>
        <h2 className="text-xl font-bold text-white">Effectifs & Blessures</h2>
      </div>

      {injuries.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wider">
            Indisponibles
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {injuries.slice(0, 10).map((inj, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-lg p-2.5 text-sm"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">{inj.player.name}</div>
                  <div className="text-[10px] text-white/50 truncate">
                    {inj.team.name} • {inj.player.reason ?? inj.player.type ?? "Indisponible"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lineups.length > 0 && (
        <div className="text-xs text-white/50">
          Compositions probables disponibles : {lineups.map((l) => l.team.name).join(" / ")}
        </div>
      )}
    </section>
  );
}


// ─── H2H — head-to-head historique (foot, via API-Football) ──────


export function HeadToHeadSection({
  apiFootballContext,
}: {
  apiFootballContext: DossierPickData["apiFootballContext"];
}) {
  if (!apiFootballContext || !apiFootballContext.h2h || apiFootballContext.h2h.length === 0) {
    return null;
  }

  const games = apiFootballContext.h2h.slice(0, 10);

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">⚔️</div>
        <h2 className="text-xl font-bold text-white">
          Confrontations directes
        </h2>
      </div>

      <div className="space-y-2">
        {games.map((g, i) => {
          const dateStr = new Date(g.fixture.date).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          const homeName = g.teams.home.name;
          const awayName = g.teams.away.name;
          const homeGoals = g.goals.home ?? 0;
          const awayGoals = g.goals.away ?? 0;
          const winnerHome = g.teams.home.winner === true;
          const winnerAway = g.teams.away.winner === true;

          return (
            <div
              key={i}
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm"
            >
              <div className="text-xs text-white/40 font-mono w-24">
                {dateStr}
              </div>
              <div className="flex-1 flex items-center justify-center gap-4">
                <span
                  className={`flex-1 text-right truncate ${
                    winnerHome ? "text-white font-bold" : "text-white/60"
                  }`}
                >
                  {homeName}
                </span>
                <span className="font-mono font-bold text-white px-2">
                  {homeGoals} - {awayGoals}
                </span>
                <span
                  className={`flex-1 truncate ${
                    winnerAway ? "text-white font-bold" : "text-white/60"
                  }`}
                >
                  {awayName}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


// ─── IA Reasoning — analyse Claude + GPT ──────────────────────────


export function IAReasoningSection({ data }: { data: DossierPickData }) {
  const hasClaude = !!data.reasoningClaude;
  const hasGpt = !!data.reasoningGpt;
  const hasFullDossier = !!data.dossierFullText;

  if (!hasClaude && !hasGpt && !hasFullDossier) return null;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🤖</div>
        <h2 className="text-xl font-bold text-white">Analyse IA</h2>
      </div>

      {hasFullDossier && data.dossierFullText && (
        <div className="prose prose-invert prose-sm max-w-none text-white/80 leading-relaxed mb-5">
          {data.dossierFullText.split("\n\n").map((para, i) => (
            <p key={i} className="mb-3">
              {para}
            </p>
          ))}
        </div>
      )}

      {!hasFullDossier && (hasClaude || hasGpt) && (
        <div className="space-y-4">
          {hasClaude && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">
                  Claude
                </span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                {data.reasoningClaude}
              </p>
            </div>
          )}
          {hasGpt && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                  GPT
                </span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                {data.reasoningGpt}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}


// ─── Disclaimer bankroll ──────────────────────────────────────────


export function DisclaimerSection() {
  return (
    <section className="rounded-2xl bg-zinc-950 border border-amber-500/20 p-5">
      <div className="flex gap-3 text-sm text-white/60 leading-relaxed">
        <div className="text-2xl">⚠️</div>
        <div>
          <div className="font-bold text-amber-300 mb-1">
            Bankroll & gestion du risque
          </div>
          <p>
            Ce pick est mathématiquement +EV mais la variance court terme reste
            importante. Mise recommandée :{" "}
            <strong className="text-white">1U flat = 10€</strong>. Ne misez
            jamais plus que ce que vous êtes prêt à perdre. Le jeu doit rester
            un divertissement.
          </p>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NOUVELLES SECTIONS v3 — Stats avancées par sport
// ═══════════════════════════════════════════════════════════════════

// ─── Football — Stats équipe (buts, BTTS%, Over25%, série) ────────

export function FootballStatsSection({
  data,
}: {
  data: DossierPickData;
}) {
  const stats = data.footballStats;
  if (!stats) return null;

  const home = stats.home as Record<string, unknown>;
  const away = stats.away as Record<string, unknown>;

  const fmt = (v: unknown, suffix = "") =>
    v != null ? `${v}${suffix}` : "—";

  const rows = [
    { label: "Buts marqués / match", h: fmt(home.buts_marques_par_match), a: fmt(away.buts_marques_par_match) },
    { label: "Buts encaissés / match", h: fmt(home.buts_encaisses_par_match), a: fmt(away.buts_encaisses_par_match) },
    { label: "Clean sheets", h: fmt(home.clean_sheets_total), a: fmt(away.clean_sheets_total) },
    { label: "BTTS %", h: fmt(home.btts_pct, "%"), a: fmt(away.btts_pct, "%") },
    { label: "Over 2.5 %", h: fmt(home.over_25_pct, "%"), a: fmt(away.over_25_pct, "%") },
    { label: "Matchs joués", h: fmt(home.matchs_joues), a: fmt(away.matchs_joues) },
  ].filter((r) => r.h !== "—" || r.a !== "—");

  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">📊</div>
        <div>
          <h2 className="text-xl font-bold text-white">Stats de la saison</h2>
          <p className="text-xs text-white/50 mt-0.5">Moyennes et pourcentages saison en cours</p>
        </div>
      </div>

      {/* Série en cours */}
      {(home.serie_en_cours || away.serie_en_cours) && (
        <div className="flex gap-3 mb-5">
          {home.serie_en_cours && (
            <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
              <div className="text-xs text-emerald-300 font-bold">{data.homeTeam}</div>
              <div className="text-xs text-white/70 mt-0.5">{String(home.serie_en_cours)}</div>
            </div>
          )}
          {away.serie_en_cours && (
            <div className="flex-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
              <div className="text-xs text-emerald-300 font-bold">{data.awayTeam}</div>
              <div className="text-xs text-white/70 mt-0.5">{String(away.serie_en_cours)}</div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 text-right pr-4 font-medium">{data.homeTeam.split(" ").pop()}</th>
              <th className="pb-3 text-center font-medium">Statistique</th>
              <th className="pb-3 text-left pl-4 font-medium">{data.awayTeam.split(" ").pop()}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-900">
                <td className="py-2.5 text-right pr-4 text-emerald-300 font-bold font-mono">{r.h}</td>
                <td className="py-2.5 text-center text-white/50 text-xs">{r.label}</td>
                <td className="py-2.5 text-left pl-4 text-violet-300 font-bold font-mono">{r.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}


// ─── Football — Prédiction API-Football ──────────────────────────

export function FootballPredictionSection({
  data,
}: {
  data: DossierPickData;
}) {
  const pred = data.footballPrediction;
  if (!pred) return null;
  if (!pred.winner && !pred.percent_home) return null;

  const home_pct = parseInt(String(pred.percent_home ?? "0").replace("%", "")) || 0;
  const draw_pct = parseInt(String(pred.percent_draw ?? "0").replace("%", "")) || 0;
  const away_pct = parseInt(String(pred.percent_away ?? "0").replace("%", "")) || 0;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🔮</div>
        <div>
          <h2 className="text-xl font-bold text-white">Prédiction algorithmique</h2>
          <p className="text-xs text-white/50 mt-0.5">Analyse API-Football indépendante</p>
        </div>
      </div>

      {/* Barres de probabilité */}
      {home_pct + draw_pct + away_pct > 0 && (
        <div className="space-y-3 mb-5">
          {[
            { label: data.homeTeam, pct: home_pct, color: "bg-emerald-500" },
            { label: "Match nul", pct: draw_pct, color: "bg-amber-500" },
            { label: data.awayTeam, pct: away_pct, color: "bg-violet-500" },
          ].filter(r => r.pct > 0).map((r, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/70">{r.label}</span>
                <span className="text-white font-bold">{r.pct}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${r.color} rounded-full transition-all`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {pred.winner && (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
            <div className="text-xs text-white/50 mb-1">Gagnant prédit</div>
            <div className="text-sm font-bold text-white">{String(pred.winner)}</div>
          </div>
        )}
        {pred.advice && (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
            <div className="text-xs text-white/50 mb-1">Conseil API</div>
            <div className="text-sm font-bold text-white">{String(pred.advice)}</div>
          </div>
        )}
        {pred.under_over && (
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3 col-span-2">
            <div className="text-xs text-white/50 mb-1">Prédiction buts</div>
            <div className="text-sm font-bold text-white">{String(pred.under_over)}</div>
          </div>
        )}
      </div>
    </section>
  );
}


// ─── Classement (Basket / Hockey / Baseball) ─────────────────────

export function ClassementSection({
  data,
}: {
  data: DossierPickData;
}) {
  const cl = data.classement;
  if (!cl) return null;

  const home = cl.home as Record<string, unknown>;
  const away = cl.away as Record<string, unknown>;

  const sportIcon = data.sport === "basketball" ? "🏀"
    : data.sport === "hockey" ? "🏒"
    : data.sport === "baseball" ? "⚾"
    : "📊";

  const pointsLabel = data.sport === "basketball" ? "Pts marqués/match"
    : data.sport === "baseball" ? "Runs marqués/match"
    : "Buts marqués/match";

  const encaissesLabel = data.sport === "basketball" ? "Pts encaissés/match"
    : data.sport === "baseball" ? "Runs encaissés/match"
    : "Buts encaissés/match";

  const fmt = (v: unknown, suffix = "") =>
    v != null ? `${v}${suffix}` : "—";

  const rows = [
    { label: "Position", h: fmt(home.position), a: fmt(away.position) },
    { label: "Bilan", h: `${fmt(home.victoires)}V-${fmt(home.defaites)}D`, a: `${fmt(away.victoires)}V-${fmt(away.defaites)}D` },
    { label: "% Victoires", h: fmt(home.win_pct, "%"), a: fmt(away.win_pct, "%") },
    { label: pointsLabel, h: fmt(home.marques_par_match), a: fmt(away.marques_par_match) },
    { label: encaissesLabel, h: fmt(home.encaisses_par_match), a: fmt(away.encaisses_par_match) },
  ].filter((r) => r.h !== "—" || r.a !== "—");

  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">{sportIcon}</div>
        <div>
          <h2 className="text-xl font-bold text-white">Classement & moyennes</h2>
          <p className="text-xs text-white/50 mt-0.5">Saison en cours</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 text-right pr-4 font-medium">{data.homeTeam.split(" ").slice(-1)[0]}</th>
              <th className="pb-3 text-center font-medium">Stat</th>
              <th className="pb-3 text-left pl-4 font-medium">{data.awayTeam.split(" ").slice(-1)[0]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-900">
                <td className="py-2.5 text-right pr-4 text-emerald-300 font-bold font-mono">{r.h}</td>
                <td className="py-2.5 text-center text-white/50 text-xs">{r.label}</td>
                <td className="py-2.5 text-left pl-4 text-violet-300 font-bold font-mono">{r.a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}


// ─── H2H réel (Basket / Hockey) ──────────────────────────────────

export function H2HReelSection({
  data,
}: {
  data: DossierPickData;
}) {
  const h2h = data.h2hReel;
  if (!h2h || !h2h.derniers_matchs || h2h.derniers_matchs.length === 0) return null;

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">⚔️</div>
        <div>
          <h2 className="text-xl font-bold text-white">Confrontations directes</h2>
          <p className="text-xs text-white/50 mt-0.5">{h2h.resume}</p>
        </div>
      </div>

      <div className="space-y-2">
        {h2h.derniers_matchs.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm"
          >
            <span className="text-white/40 text-xs font-mono w-5 text-center">{i + 1}</span>
            <span className="text-white/80">{m}</span>
          </div>
        ))}
      </div>
    </section>
  );
}


// ─── Lanceurs partants baseball ───────────────────────────────────

export function PitchersSection({
  data,
}: {
  data: DossierPickData;
}) {
  const pitchers = data.pitchers;
  if (!pitchers) return null;
  if (!pitchers.home && !pitchers.away) return null;

  const fmt = (v: unknown, suffix = "", decimals = 2) => {
    if (v == null) return "—";
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return isNaN(n) ? String(v) : `${n.toFixed(decimals)}${suffix}`;
  };

  const renderPitcher = (p: Record<string, unknown> | null, team: string, side: "home" | "away") => {
    if (!p) return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
        <div className={`text-xs font-bold mb-1 ${side === "home" ? "text-emerald-300" : "text-violet-300"}`}>{team}</div>
        <div className="text-xs text-white/40">Lanceur non confirmé</div>
      </div>
    );

    const era = typeof p.era === "number" ? p.era : null;
    const eraColor = era === null ? "text-white" : era < 3.0 ? "text-emerald-300" : era > 5.0 ? "text-red-400" : "text-amber-300";

    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
        <div className={`text-xs font-bold mb-1 ${side === "home" ? "text-emerald-300" : "text-violet-300"}`}>{team}</div>
        <div className="text-base font-bold text-white mb-3">{String(p.nom ?? "?")}</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className={`text-xl font-black font-mono ${eraColor}`}>{fmt(p.era)}</div>
            <div className="text-[10px] text-white/40 uppercase mt-0.5">ERA</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black font-mono text-white">{fmt(p.whip)}</div>
            <div className="text-[10px] text-white/40 uppercase mt-0.5">WHIP</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black font-mono text-white">{fmt(p.k_per_9, "", 1)}</div>
            <div className="text-[10px] text-white/40 uppercase mt-0.5">K/9</div>
          </div>
        </div>
        {(p.victoires != null || p.defaites != null) && (
          <div className="mt-3 text-center text-xs text-white/50">
            Bilan : {fmt(p.victoires, "V", 0)} – {fmt(p.defaites, "D", 0)}
            {p.innings_lances != null && ` · ${fmt(p.innings_lances, " IP", 1)}`}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">⚾</div>
        <div>
          <h2 className="text-xl font-bold text-white">Lanceurs partants</h2>
          <p className="text-xs text-white/50 mt-0.5">ERA &lt; 3.00 = excellent · WHIP &lt; 1.20 = excellent · K/9 &gt; 9 = dominant</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPitcher(pitchers.home as Record<string, unknown> | null, data.homeTeam, "home")}
        {renderPitcher(pitchers.away as Record<string, unknown> | null, data.awayTeam, "away")}
      </div>
    </section>
  );
}


// ─── Records MMA fighters ─────────────────────────────────────────

export function MMARecordsSection({
  data,
}: {
  data: DossierPickData;
}) {
  const records = data.recordsFighters;
  if (!records || Object.keys(records).length === 0) return null;

  const renderFighter = (name: string, r: Record<string, unknown>, side: "home" | "away") => {
    const wins = r.victoires as number | null;
    const losses = r.defaites as number | null;
    const draws = r.nuls as number | null;
    const ko_pct = r.ko_pct as number | null;
    const sub_pct = r.submission_pct as number | null;
    const dec_pct = r.decision_pct as number | null;

    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
        <div className={`text-xs font-bold mb-1 ${side === "home" ? "text-emerald-300" : "text-violet-300"}`}>
          {side === "home" ? "🏠" : "✈️"} {name}
        </div>
        <div className="text-2xl font-black text-white font-mono mb-3">
          {wins ?? "?"}V – {losses ?? "?"}D{draws ? ` – ${draws}N` : ""}
        </div>

        {(ko_pct != null || sub_pct != null || dec_pct != null) && (
          <div className="space-y-2">
            {ko_pct != null && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-red-400 font-semibold">KO/TKO ({r.ko_tko ?? 0})</span>
                  <span className="text-white font-bold">{ko_pct}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${ko_pct}%` }} />
                </div>
              </div>
            )}
            {sub_pct != null && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-400 font-semibold">Soumission ({r.submissions ?? 0})</span>
                  <span className="text-white font-bold">{sub_pct}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${sub_pct}%` }} />
                </div>
              </div>
            )}
            {dec_pct != null && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-400 font-semibold">Décision ({r.decisions ?? 0})</span>
                  <span className="text-white font-bold">{dec_pct}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${dec_pct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const fighters = Object.entries(records);

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🥊</div>
        <div>
          <h2 className="text-xl font-bold text-white">Records & méthodes de victoire</h2>
          <p className="text-xs text-white/50 mt-0.5">Carrière professionnelle complète</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fighters.map(([name, record], i) => (
          renderFighter(name, record, i === 0 ? "home" : "away")
        ))}
      </div>
    </section>
  );
}