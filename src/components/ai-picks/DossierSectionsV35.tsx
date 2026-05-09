/**
 * ═══════════════════════════════════════════════════════════════════
 * DossierSectionsV35.tsx — Nouvelles sections V3.5
 * ═══════════════════════════════════════════════════════════════════
 *
 * Composants visuels V3.5 — extension de DossierSections.tsx
 * pour exposer les données enrichies (tier, CLV, foot enrichi, tennis
 * enrichi, rugby, handball, F1).
 *
 * Server components (pas d'interactivité, juste de l'affichage).
 *
 * Sections livrées dans ce batch (1/2) :
 *   - TierBadgeSection : badge tier + tooltip explicatif
 *   - CLVIndicatorSection : indicateur CLV final (post-résolution)
 *   - FootballSplitsSection : stats domicile/extérieur
 *   - FootballRecentMatchesSection : 5 derniers matchs détaillés
 *   - FootballSidelinedSection : absents/suspendus
 *   - FootballTopScorersSection : top buteurs de la league
 *
 * Path : src/components/ai-picks/DossierSectionsV35.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import type { DossierPickData } from "@/lib/ai-picks-v2/dossier-builder";
import type { FootballRecentMatchStats } from "@/lib/ai-picks-v3/tipster-types";

// ============================================================================
// HELPERS
// ============================================================================

const fmtPct = (n: number | null | undefined, decimals: number = 1): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(decimals)}%`;
};

const fmtNum = (n: number | null | undefined, decimals: number = 0): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "—";
  }
};

// ============================================================================
// 1. TIER BADGE — affiché en haut de page sous le hero
// ============================================================================

const TIER_DISPLAY: Record<
  string,
  {
    emoji: string;
    label: string;
    description: string;
    bgGradient: string;
    borderColor: string;
    textColor: string;
    accentColor: string;
  }
> = {
  lock: {
    emoji: "🔒",
    label: "LOCK",
    description:
      "Confiance maximale (≥80) avec edge significatif (≥5%). Notre conviction la plus forte du jour.",
    bgGradient: "from-emerald-950 via-emerald-900/40 to-emerald-950",
    borderColor: "border-emerald-500/40",
    textColor: "text-emerald-100",
    accentColor: "text-emerald-300",
  },
  strong: {
    emoji: "💪",
    label: "STRONG",
    description:
      "Pick solide avec confiance élevée (75-79). Plusieurs arguments alignés (forme, stats, contexte).",
    bgGradient: "from-blue-950 via-blue-900/40 to-blue-950",
    borderColor: "border-blue-500/40",
    textColor: "text-blue-100",
    accentColor: "text-blue-300",
  },
  value: {
    emoji: "💎",
    label: "VALUE",
    description:
      "Bon edge mathématique (≥3%) avec confiance correcte (70-74). La cote paie mieux que la probabilité réelle.",
    bgGradient: "from-violet-950 via-violet-900/40 to-violet-950",
    borderColor: "border-violet-500/40",
    textColor: "text-violet-100",
    accentColor: "text-violet-300",
  },
  coup_de_coeur: {
    emoji: "❤️",
    label: "COUP DE CŒUR",
    description:
      "Opportunité plus risquée (confiance 65-69). À jouer avec une mise réduite ou pour le fun.",
    bgGradient: "from-pink-950 via-pink-900/40 to-pink-950",
    borderColor: "border-pink-500/40",
    textColor: "text-pink-100",
    accentColor: "text-pink-300",
  },
};

export function TierBadgeSection({ data }: { data: DossierPickData }) {
  if (!data.tier) return null;
  const info = TIER_DISPLAY[data.tier];
  if (!info) return null;

  return (
    <section
      className={`rounded-2xl bg-gradient-to-br ${info.bgGradient} border ${info.borderColor} p-5`}
    >
      <div className="flex items-start gap-4">
        <div className="text-4xl shrink-0">{info.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span
              className={`text-xl font-black tracking-wider ${info.textColor}`}
            >
              {info.label}
            </span>
            <span className="px-2 py-0.5 bg-white/10 backdrop-blur rounded-full text-[10px] font-bold uppercase tracking-wider text-white/70">
              Catégorie pick
            </span>
            {data.dropWindow && (
              <span className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] font-medium text-white/50">
                {data.dropWindow === "morning" ? "🌅 Drop matin" : "🌙 Drop soir"}
              </span>
            )}
          </div>
          <p className={`text-sm leading-relaxed ${info.accentColor}/80`}>
            {info.description}
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 2. CLV INDICATOR — affiché si pick résolu avec CLV calculé
// ============================================================================

export function CLVIndicatorSection({ data }: { data: DossierPickData }) {
  if (data.clvPctFinal === null || data.clvPctFinal === undefined) return null;

  const clvPct100 = data.clvPctFinal * 100; // clv_pct est stocké en décimal (0.05 = 5%)
  const isPositive = clvPct100 > 0;
  const sign = isPositive ? "+" : "";
  const absVal = Math.abs(clvPct100);

  // Échelle d'interprétation du CLV
  let interpretation: string;
  let strengthLabel: string;
  let bgColor: string;
  let borderColor: string;
  let textColor: string;
  let emoji: string;

  if (clvPct100 >= 5) {
    strengthLabel = "EDGE ÉLITE";
    interpretation =
      "Excellent. Notre cote a battu le marché efficient final de plus de 5%. C'est le niveau qu'on cherche en value betting professionnel.";
    bgColor = "from-emerald-950 via-emerald-900/30 to-emerald-950";
    borderColor = "border-emerald-500/40";
    textColor = "text-emerald-200";
    emoji = "🏆";
  } else if (clvPct100 >= 2) {
    strengthLabel = "EDGE FORT";
    interpretation =
      "Solide. Notre cote a battu le marché de référence (Pinnacle no-vig). Sur la durée, ce type d'edge génère du profit.";
    bgColor = "from-emerald-950 via-emerald-900/20 to-emerald-950";
    borderColor = "border-emerald-500/30";
    textColor = "text-emerald-200";
    emoji = "⚡";
  } else if (clvPct100 > 0) {
    strengthLabel = "EDGE LÉGER";
    interpretation =
      "Notre cote a légèrement battu le marché efficient final. Edge modeste mais positif.";
    bgColor = "from-zinc-950 via-emerald-950/10 to-zinc-950";
    borderColor = "border-emerald-500/20";
    textColor = "text-emerald-200";
    emoji = "📈";
  } else if (clvPct100 === 0) {
    strengthLabel = "NEUTRE";
    interpretation =
      "Notre cote était parfaitement alignée avec le marché efficient final.";
    bgColor = "from-zinc-950 to-zinc-950";
    borderColor = "border-zinc-700";
    textColor = "text-white/70";
    emoji = "⚪";
  } else {
    strengthLabel = "SOUS-PERFORMANCE";
    interpretation =
      "Notre cote était inférieure au marché efficient final. C'est le revers de la variance court terme — on monitore sur la moyenne 30+ picks.";
    bgColor = "from-zinc-950 via-red-950/20 to-zinc-950";
    borderColor = "border-red-500/30";
    textColor = "text-red-200";
    emoji = "📉";
  }

  return (
    <section
      className={`rounded-2xl bg-gradient-to-br ${bgColor} border ${borderColor} p-6`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">{emoji}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl font-bold text-white">
              Closing Line Value
            </h2>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${textColor} bg-white/5`}
            >
              {strengthLabel}
            </span>
          </div>
          <p className="text-xs text-white/50">
            Mesure si notre cote bat le marché de référence après mouvement final
          </p>
        </div>
      </div>

      {/* Valeur centrale */}
      <div className="text-center py-4 mb-4 bg-black/20 rounded-xl">
        <div className={`text-5xl md:text-6xl font-black font-mono ${textColor}`}>
          {sign}
          {absVal.toFixed(2)}%
        </div>
        <div className="text-xs text-white/50 uppercase tracking-wider mt-2">
          Edge marché efficient
        </div>
      </div>

      {/* Interprétation */}
      <p className="text-sm text-white/70 leading-relaxed">{interpretation}</p>

      {/* Échelle visuelle */}
      <div className="mt-5">
        <div className="flex justify-between text-[10px] text-white/40 mb-2 font-mono">
          <span>-5%</span>
          <span>0%</span>
          <span>+2%</span>
          <span>+5%</span>
          <span>+10%</span>
        </div>
        <div className="relative h-2 bg-zinc-900 rounded-full">
          {/* Zone neutre */}
          <div
            className="absolute h-full w-px bg-white/20"
            style={{ left: "33.33%" }}
          />
          {/* Curseur position actuelle */}
          <div
            className={`absolute h-full w-2 -translate-x-1/2 rounded-full ${
              isPositive ? "bg-emerald-400" : "bg-red-400"
            }`}
            style={{
              left: `${Math.max(0, Math.min(100, ((clvPct100 + 5) / 15) * 100))}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 3. FOOTBALL SPLITS — domicile/extérieur
// ============================================================================

export function FootballSplitsSection({ data }: { data: DossierPickData }) {
  if (!data.footballSplits) return null;

  const home = data.footballSplits.home_team_at_home;
  const away = data.footballSplits.away_team_at_away;

  // Vérifie qu'on a au moins quelques data utiles
  const hasData =
    home.matchs_joues !== null ||
    home.victoires !== null ||
    away.matchs_joues !== null ||
    away.victoires !== null;
  if (!hasData) return null;

  const computeWinPct = (
    v: number | null,
    n: number | null,
    d: number | null
  ): number | null => {
    const total = (v ?? 0) + (n ?? 0) + (d ?? 0);
    if (total === 0) return null;
    return ((v ?? 0) / total) * 100;
  };

  const homeWinPct = computeWinPct(
    home.victoires,
    home.nuls,
    home.defaites
  );
  const awayWinPct = computeWinPct(
    away.victoires,
    away.nuls,
    away.defaites
  );

  const rows: { label: string; h: string; a: string }[] = [
    {
      label: "Matchs joués",
      h: fmtNum(home.matchs_joues),
      a: fmtNum(away.matchs_joues),
    },
    {
      label: "Bilan (V-N-D)",
      h: `${fmtNum(home.victoires)}-${fmtNum(home.nuls)}-${fmtNum(home.defaites)}`,
      a: `${fmtNum(away.victoires)}-${fmtNum(away.nuls)}-${fmtNum(away.defaites)}`,
    },
    { label: "% Victoires", h: fmtPct(homeWinPct), a: fmtPct(awayWinPct) },
    {
      label: "Buts marqués",
      h: fmtNum(home.buts_marques),
      a: fmtNum(away.buts_marques),
    },
    {
      label: "Buts encaissés",
      h: fmtNum(home.buts_encaisses),
      a: fmtNum(away.buts_encaisses),
    },
    {
      label: "Moy. buts marqués/match",
      h: home.buts_marques_avg ?? "—",
      a: away.buts_marques_avg ?? "—",
    },
    {
      label: "Moy. buts encaissés/match",
      h: home.buts_encaisses_avg ?? "—",
      a: away.buts_encaisses_avg ?? "—",
    },
  ].filter((r) => r.h !== "—" || r.a !== "—");

  if (rows.length === 0) return null;

  const homeShort = data.homeTeam.split(" ").slice(-1)[0];
  const awayShort = data.awayTeam.split(" ").slice(-1)[0];

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🏟️</div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Performance domicile / extérieur
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            {homeShort} à domicile vs {awayShort} en déplacement (saison en cours)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 text-right pr-4 font-medium">
                {homeShort} <span className="text-emerald-400">🏠 Dom.</span>
              </th>
              <th className="pb-3 text-center font-medium">Stat</th>
              <th className="pb-3 text-left pl-4 font-medium">
                <span className="text-violet-400">✈️ Ext.</span> {awayShort}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-zinc-900">
                <td className="py-2.5 text-right pr-4 text-emerald-300 font-bold font-mono">
                  {r.h}
                </td>
                <td className="py-2.5 text-center text-white/50 text-xs">
                  {r.label}
                </td>
                <td className="py-2.5 text-left pl-4 text-violet-300 font-bold font-mono">
                  {r.a}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================================
// 4. FOOTBALL RECENT MATCHES — 5 derniers matchs détaillés
// ============================================================================

export function FootballRecentMatchesSection({
  data,
}: {
  data: DossierPickData;
}) {
  if (!data.footballRecentMatches) return null;

  const home = data.footballRecentMatches.home;
  const away = data.footballRecentMatches.away;

  if ((!home || home.length === 0) && (!away || away.length === 0)) return null;

  const renderMatchRow = (m: FootballRecentMatchStats) => {
    const resultColor =
      m.resultat === "V"
        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
        : m.resultat === "D"
          ? "text-red-400 bg-red-500/10 border-red-500/30"
          : "text-amber-400 bg-amber-500/10 border-amber-500/30";

    return (
      <div
        key={m.fixture_id}
        className="rounded-xl bg-zinc-900 border border-zinc-800 p-3"
      >
        {/* Header : résultat + adversaire + date */}
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-black border ${resultColor}`}
          >
            {m.resultat ?? "—"}
          </span>
          <span className="text-sm text-white/80 font-medium truncate flex-1">
            vs {m.adversaire}
          </span>
          <span className="text-xs text-white/40 font-mono shrink-0">
            {fmtDate(m.date)}
          </span>
        </div>

        {/* Score */}
        {m.score && (
          <div className="text-lg font-bold text-white font-mono mb-2">
            {m.score}
          </div>
        )}

        {/* Stats compactes */}
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          {m.possession !== null && (
            <div>
              <div className="text-white/40 uppercase">Poss.</div>
              <div className="text-white/80 font-mono font-bold">
                {fmtNum(m.possession)}%
              </div>
            </div>
          )}
          {m.tirs_total !== null && (
            <div>
              <div className="text-white/40 uppercase">Tirs</div>
              <div className="text-white/80 font-mono font-bold">
                {fmtNum(m.tirs_cadres)}/{fmtNum(m.tirs_total)}
              </div>
            </div>
          )}
          {m.xg !== null && (
            <div>
              <div className="text-white/40 uppercase">xG</div>
              <div className="text-white/80 font-mono font-bold">
                {fmtNum(m.xg, 2)}
              </div>
            </div>
          )}
          {m.corners !== null && (
            <div>
              <div className="text-white/40 uppercase">Corners</div>
              <div className="text-white/80 font-mono font-bold">
                {fmtNum(m.corners)}
              </div>
            </div>
          )}
          {m.cartons_jaunes !== null && (
            <div>
              <div className="text-white/40 uppercase">CJ/CR</div>
              <div className="text-white/80 font-mono font-bold">
                {fmtNum(m.cartons_jaunes)}/{fmtNum(m.cartons_rouges)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const homeShort = data.homeTeam.split(" ").slice(-1)[0];
  const awayShort = data.awayTeam.split(" ").slice(-1)[0];

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">📋</div>
        <div>
          <h2 className="text-xl font-bold text-white">5 derniers matchs</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Détail des stats récentes par équipe (xG si dispo top 5 leagues)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Home column */}
        <div>
          <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>🏠 {homeShort}</span>
            <span className="text-white/30 font-medium">
              ({home?.length ?? 0} match{(home?.length ?? 0) > 1 ? "s" : ""})
            </span>
          </div>
          {home && home.length > 0 ? (
            <div className="space-y-2">{home.map(renderMatchRow)}</div>
          ) : (
            <div className="text-xs text-white/30 italic">
              Pas de données récentes disponibles
            </div>
          )}
        </div>

        {/* Away column */}
        <div>
          <div className="text-xs font-bold text-violet-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>✈️ {awayShort}</span>
            <span className="text-white/30 font-medium">
              ({away?.length ?? 0} match{(away?.length ?? 0) > 1 ? "s" : ""})
            </span>
          </div>
          {away && away.length > 0 ? (
            <div className="space-y-2">{away.map(renderMatchRow)}</div>
          ) : (
            <div className="text-xs text-white/30 italic">
              Pas de données récentes disponibles
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 5. FOOTBALL SIDELINED — absents/suspendus
// ============================================================================

export function FootballSidelinedSection({ data }: { data: DossierPickData }) {
  if (!data.footballSidelined) return null;

  const home = data.footballSidelined.home;
  const away = data.footballSidelined.away;

  if ((!home || home.length === 0) && (!away || away.length === 0)) return null;

  const formatType = (type: string | null): { label: string; emoji: string } => {
    if (!type) return { label: "Absent", emoji: "❓" };
    const t = type.toLowerCase();
    if (t.includes("suspend")) return { label: "Suspendu", emoji: "🟥" };
    if (t.includes("injur") || t.includes("blessure"))
      return { label: type, emoji: "🤕" };
    if (t.includes("ill") || t.includes("malad"))
      return { label: "Maladie", emoji: "🤒" };
    return { label: type, emoji: "🚫" };
  };

  const renderTeamColumn = (
    items: typeof home,
    teamName: string,
    side: "home" | "away"
  ) => {
    const accentColor = side === "home" ? "text-emerald-300" : "text-violet-300";
    const sideEmoji = side === "home" ? "🏠" : "✈️";

    return (
      <div>
        <div
          className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${accentColor}`}
        >
          <span>
            {sideEmoji} {teamName}
          </span>
          <span className="text-white/30 font-medium">
            ({items.length} absent{items.length > 1 ? "s" : ""})
          </span>
        </div>
        {items.length === 0 ? (
          <div className="text-xs text-emerald-400/60 italic">
            ✓ Effectif au complet
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => {
              const { label, emoji } = formatType(item.type);
              return (
                <div
                  key={i}
                  className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {item.player_name}
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        {label}
                      </div>
                      {item.end_date && (
                        <div className="text-[10px] text-white/40 font-mono mt-1">
                          Retour estimé : {fmtDate(item.end_date)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🚑</div>
        <div>
          <h2 className="text-xl font-bold text-white">Absents & suspendus</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Liste complète (blessures + suspensions cartons + maladie)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {renderTeamColumn(home ?? [], data.homeTeam, "home")}
        {renderTeamColumn(away ?? [], data.awayTeam, "away")}
      </div>
    </section>
  );
}

// ============================================================================
// 6. FOOTBALL TOP SCORERS — top buteurs de la league
// ============================================================================

export function FootballTopScorersSection({
  data,
}: {
  data: DossierPickData;
}) {
  if (!data.footballTopScorers || data.footballTopScorers.length === 0)
    return null;

  // On affiche max 8 top scorers
  const scorers = data.footballTopScorers.slice(0, 8);

  // Calcul du % apparitions buts (efficacité)
  const computeRate = (
    buts: number,
    apparitions: number
  ): { value: string; class: string } => {
    if (!apparitions) return { value: "—", class: "text-white/40" };
    const rate = buts / apparitions;
    if (rate >= 0.7) return { value: rate.toFixed(2), class: "text-emerald-300" };
    if (rate >= 0.4) return { value: rate.toFixed(2), class: "text-amber-300" };
    return { value: rate.toFixed(2), class: "text-white/60" };
  };

  // On détecte si un buteur joue dans une des 2 équipes du match (highlight)
  const isInMatch = (teamName: string): boolean => {
    const t = teamName.toLowerCase().trim();
    const h = data.homeTeam.toLowerCase();
    const a = data.awayTeam.toLowerCase();
    return h.includes(t) || a.includes(t) || t.includes(h) || t.includes(a);
  };

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">⚽</div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Meilleurs buteurs de la ligue
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Top 8 saison en cours · joueurs des 2 équipes mis en évidence
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 pr-4 text-left font-medium w-10">#</th>
              <th className="pb-3 pr-4 text-left font-medium">Joueur</th>
              <th className="pb-3 pr-4 text-left font-medium">Équipe</th>
              <th className="pb-3 pr-3 text-right font-medium">Buts</th>
              <th className="pb-3 pr-3 text-right font-medium">Apps</th>
              <th className="pb-3 text-right font-medium">B/M</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((s, i) => {
              const rate = computeRate(s.buts_saison, s.apparitions);
              const inMatch = isInMatch(s.team_name);
              const rowBg = inMatch
                ? "bg-violet-500/5 border-violet-500/20"
                : "border-zinc-900";
              return (
                <tr key={i} className={`border-b ${rowBg}`}>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`text-xs font-mono font-bold ${
                        i < 3 ? "text-amber-300" : "text-white/40"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`font-semibold ${
                        inMatch ? "text-violet-200" : "text-white"
                      }`}
                    >
                      {s.player_name}
                    </span>
                    {inMatch && (
                      <span className="ml-2 px-1.5 py-0.5 bg-violet-500/30 text-violet-200 text-[9px] font-bold rounded uppercase">
                        Dans le match
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-white/60 text-xs truncate max-w-[140px]">
                    {s.team_name}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-bold font-mono text-white">
                    {s.buts_saison}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-white/60">
                    {s.apparitions}
                  </td>
                  <td
                    className={`py-2.5 text-right font-mono font-bold ${rate.class}`}
                  >
                    {rate.value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[10px] text-white/40 italic">
        B/M = Buts par match · ≥0.7 (excellent) · ≥0.4 (régulier) · &lt;0.4 (occasionnel)
      </div>
    </section>
  );
}