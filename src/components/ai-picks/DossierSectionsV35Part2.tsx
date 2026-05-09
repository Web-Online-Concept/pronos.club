/**
 * ═══════════════════════════════════════════════════════════════════
 * DossierSectionsV35Part2.tsx — Sections V3.5 (suite)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Composants visuels V3.5 — partie 2 (les 7 dernières sections).
 *
 * Sections livrées :
 *   - TennisPastMatchesSection   : 5 derniers matchs avec cotes pré-match
 *   - TennisTournamentRecordSection : palmarès joueur sur ce tournoi
 *   - TennisCareerStatsSection   : stats serve/return de carrière
 *   - TennisFinalsTitlesSection  : finales et titres (SF/Final uniquement)
 *   - RugbyStatsSection          : stats rugby (Top 14, 6 Nations)
 *   - HandballStatsSection       : stats handball (Starligue, EHF)
 *   - F1RaceSection              : données GP F1 (qualif, grille, pilotes)
 *
 * Path : src/components/ai-picks/DossierSectionsV35Part2.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import type { DossierPickData } from "@/lib/ai-picks-v2/dossier-builder";
import type {
  TennisPastMatchWithOdds,
  F1DriverStats,
} from "@/lib/ai-picks-v3/tipster-types";

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
      year: "2-digit",
    });
  } catch {
    return "—";
  }
};

const fmtOdds = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
};

/**
 * Pour le tennis, on extrait les 2 noms de joueurs depuis event_name.
 * Ex: "Sinner vs Alcaraz" → ["Sinner", "Alcaraz"]
 */
const extractPlayersFromEventName = (
  eventName: string
): { player1: string; player2: string } => {
  const sep = eventName.includes(" vs ")
    ? " vs "
    : eventName.includes(" - ")
      ? " - "
      : null;
  if (!sep) return { player1: eventName, player2: "" };
  const parts = eventName.split(sep);
  return { player1: parts[0]?.trim() ?? "", player2: parts[1]?.trim() ?? "" };
};

// ============================================================================
// 7. TENNIS PAST MATCHES — 5 derniers matchs avec cotes pré-match
// ============================================================================

export function TennisPastMatchesSection({ data }: { data: DossierPickData }) {
  if (!data.tennisPastMatches) return null;

  const p1 = data.tennisPastMatches.player1;
  const p2 = data.tennisPastMatches.player2;

  if ((!p1 || p1.length === 0) && (!p2 || p2.length === 0)) return null;

  const { player1, player2 } = extractPlayersFromEventName(data.eventName);

  const renderMatchRow = (m: TennisPastMatchWithOdds, isFavorite: boolean) => {
    const resultColor =
      m.result === "W"
        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
        : m.result === "L"
          ? "text-red-400 bg-red-500/10 border-red-500/30"
          : "text-white/40 bg-zinc-800 border-zinc-700";

    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-black border ${resultColor}`}
          >
            {m.result ?? "—"}
          </span>
          <span className="text-sm text-white/80 font-medium truncate flex-1">
            vs {m.opponent}
          </span>
          <span className="text-xs text-white/40 font-mono shrink-0">
            {fmtDate(m.date)}
          </span>
        </div>

        <div className="text-xs text-white/60 mb-2 truncate">
          {m.tournament}
          {m.surface && (
            <span className="text-white/40 ml-1">· {m.surface}</span>
          )}
        </div>

        {m.score && (
          <div className="text-sm text-white font-mono mb-2">{m.score}</div>
        )}

        {/* Cotes pré-match */}
        {(m.odd_player !== null || m.odd_opponent !== null) && (
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-black/30 rounded p-1.5">
              <div className="text-white/40 uppercase">Cote joueur</div>
              <div
                className={`font-mono font-bold text-base ${isFavorite ? "text-emerald-300" : "text-white"}`}
              >
                {fmtOdds(m.odd_player)}
              </div>
            </div>
            <div className="bg-black/30 rounded p-1.5">
              <div className="text-white/40 uppercase">Cote adv.</div>
              <div className="font-mono font-bold text-base text-white/70">
                {fmtOdds(m.odd_opponent)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper : déterminer si le joueur était favori (cote < adversaire)
  const wasFavorite = (m: TennisPastMatchWithOdds): boolean => {
    if (m.odd_player === null || m.odd_opponent === null) return false;
    return m.odd_player < m.odd_opponent;
  };

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🎾</div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Derniers matchs avec cotes
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Filtré : Masters 1000+ et Grand Chelem · cote du joueur en{" "}
            <span className="text-emerald-300">vert</span> si favori
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Player 1 */}
        <div>
          <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-3">
            {player1}{" "}
            <span className="text-white/30 font-medium">
              ({p1?.length ?? 0} match{(p1?.length ?? 0) > 1 ? "s" : ""})
            </span>
          </div>
          {p1 && p1.length > 0 ? (
            <div className="space-y-2">
              {p1.map((m, i) => (
                <div key={i}>{renderMatchRow(m, wasFavorite(m))}</div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-white/30 italic">
              Pas de données récentes
            </div>
          )}
        </div>

        {/* Player 2 */}
        <div>
          <div className="text-xs font-bold text-violet-300 uppercase tracking-wider mb-3">
            {player2}{" "}
            <span className="text-white/30 font-medium">
              ({p2?.length ?? 0} match{(p2?.length ?? 0) > 1 ? "s" : ""})
            </span>
          </div>
          {p2 && p2.length > 0 ? (
            <div className="space-y-2">
              {p2.map((m, i) => (
                <div key={i}>{renderMatchRow(m, wasFavorite(m))}</div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-white/30 italic">
              Pas de données récentes
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// 8. TENNIS TOURNAMENT RECORD — palmarès sur ce tournoi
// ============================================================================

export function TennisTournamentRecordSection({
  data,
}: {
  data: DossierPickData;
}) {
  if (!data.tennisTournamentRecord) return null;

  const p1 = data.tennisTournamentRecord.player1;
  const p2 = data.tennisTournamentRecord.player2;

  if (!p1 && !p2) return null;

  const { player1, player2 } = extractPlayersFromEventName(data.eventName);

  const tournamentName = p1?.tournament_name ?? p2?.tournament_name ?? "ce tournoi";

  const renderPlayerCard = (
    record: typeof p1,
    name: string,
    side: "player1" | "player2"
  ) => {
    const accentColor = side === "player1" ? "text-emerald-300" : "text-violet-300";
    const bgColor =
      side === "player1"
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-violet-500/20 bg-violet-500/5";

    if (!record) {
      return (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <div className={`text-sm font-bold mb-1 ${accentColor}`}>{name}</div>
          <div className="text-xs text-white/40">
            Pas de données sur ce tournoi
          </div>
        </div>
      );
    }

    const winRate =
      record.total_wins + record.total_losses > 0
        ? (record.total_wins / (record.total_wins + record.total_losses)) * 100
        : null;

    return (
      <div className={`rounded-xl border p-4 ${bgColor}`}>
        <div className={`text-sm font-bold mb-3 ${accentColor}`}>{name}</div>

        {/* Stats globales */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center">
            <div className="text-2xl font-black text-white font-mono">
              {record.total_wins}
            </div>
            <div className="text-[10px] text-white/40 uppercase mt-0.5">
              Victoires
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-white font-mono">
              {record.total_losses}
            </div>
            <div className="text-[10px] text-white/40 uppercase mt-0.5">
              Défaites
            </div>
          </div>
          <div className="text-center">
            <div
              className={`text-2xl font-black font-mono ${winRate !== null && winRate >= 60 ? "text-emerald-300" : "text-white"}`}
            >
              {fmtPct(winRate, 0)}
            </div>
            <div className="text-[10px] text-white/40 uppercase mt-0.5">
              % Win
            </div>
          </div>
        </div>

        {/* Best result */}
        {record.best_round_reached && (
          <div className="bg-black/30 rounded p-2 mb-3 text-center">
            <div className="text-[10px] text-white/40 uppercase mb-0.5">
              Meilleur résultat carrière
            </div>
            <div className="text-sm font-bold text-amber-300">
              🏆 {record.best_round_reached}
            </div>
          </div>
        )}

        {/* Yearly breakdown */}
        {record.yearly_breakdown && record.yearly_breakdown.length > 0 && (
          <div>
            <div className="text-[10px] text-white/40 uppercase mb-2">
              5 dernières participations
            </div>
            <div className="space-y-1">
              {record.yearly_breakdown.slice(0, 5).map((y, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs bg-zinc-900/50 rounded px-2 py-1"
                >
                  <span className="text-white/60 font-mono">{y.year}</span>
                  <span className="text-white/80">
                    {y.wins}V – {y.losses}D
                  </span>
                  {y.round && (
                    <span className="text-white/50 italic">{y.round}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🏟️</div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Historique sur ce tournoi
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Palmarès des 2 joueurs sur {tournamentName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPlayerCard(p1, player1, "player1")}
        {renderPlayerCard(p2, player2, "player2")}
      </div>
    </section>
  );
}

// ============================================================================
// 9. TENNIS CAREER STATS — serve/return de carrière
// ============================================================================

export function TennisCareerStatsSection({ data }: { data: DossierPickData }) {
  if (!data.tennisCareerStats) return null;

  const p1 = data.tennisCareerStats.player1;
  const p2 = data.tennisCareerStats.player2;

  if (!p1 && !p2) return null;

  const { player1, player2 } = extractPlayersFromEventName(data.eventName);

  // Helper : compare 2 valeurs et retourne la couleur (better = emerald)
  const compareColor = (
    val: number | null,
    other: number | null,
    higherIsBetter: boolean = true
  ): string => {
    if (val === null || other === null) return "text-white";
    if (val === other) return "text-white";
    const isBetter = higherIsBetter ? val > other : val < other;
    return isBetter ? "text-emerald-300" : "text-white/60";
  };

  const rows: {
    label: string;
    p1: number | null | undefined;
    p2: number | null | undefined;
    higherIsBetter: boolean;
    suffix?: string;
    decimals?: number;
  }[] = [
    {
      label: "Aces / match",
      p1: p1?.aces_per_match,
      p2: p2?.aces_per_match,
      higherIsBetter: true,
      decimals: 1,
    },
    {
      label: "Doubles fautes / match",
      p1: p1?.double_faults_per_match,
      p2: p2?.double_faults_per_match,
      higherIsBetter: false,
      decimals: 1,
    },
    {
      label: "% 1ère balle in",
      p1: p1?.first_serve_in_pct,
      p2: p2?.first_serve_in_pct,
      higherIsBetter: true,
      suffix: "%",
      decimals: 1,
    },
    {
      label: "% gain 1ère balle",
      p1: p1?.first_serve_won_pct,
      p2: p2?.first_serve_won_pct,
      higherIsBetter: true,
      suffix: "%",
      decimals: 1,
    },
    {
      label: "% gain 2ème balle",
      p1: p1?.second_serve_won_pct,
      p2: p2?.second_serve_won_pct,
      higherIsBetter: true,
      suffix: "%",
      decimals: 1,
    },
    {
      label: "% break point sauvés",
      p1: p1?.break_points_saved_pct,
      p2: p2?.break_points_saved_pct,
      higherIsBetter: true,
      suffix: "%",
      decimals: 1,
    },
    {
      label: "% break point convertis",
      p1: p1?.break_points_converted_pct,
      p2: p2?.break_points_converted_pct,
      higherIsBetter: true,
      suffix: "%",
      decimals: 1,
    },
  ].filter((r) => r.p1 !== null || r.p2 !== null);

  if (rows.length === 0) return null;

  const fmtVal = (
    v: number | null | undefined,
    suffix: string = "",
    decimals: number = 1
  ): string => {
    if (v === null || v === undefined || !Number.isFinite(v)) return "—";
    return `${v.toFixed(decimals)}${suffix}`;
  };

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">📈</div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Stats serve / return carrière
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Profil technique des 2 joueurs · meilleure stat en{" "}
            <span className="text-emerald-300">vert</span>
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 text-right pr-4 font-medium">{player1}</th>
              <th className="pb-3 text-center font-medium">Stat</th>
              <th className="pb-3 text-left pl-4 font-medium">{player2}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p1Color = compareColor(
                r.p1 ?? null,
                r.p2 ?? null,
                r.higherIsBetter
              );
              const p2Color = compareColor(
                r.p2 ?? null,
                r.p1 ?? null,
                r.higherIsBetter
              );
              return (
                <tr key={i} className="border-b border-zinc-900">
                  <td
                    className={`py-2.5 text-right pr-4 font-bold font-mono ${p1Color}`}
                  >
                    {fmtVal(r.p1, r.suffix, r.decimals)}
                  </td>
                  <td className="py-2.5 text-center text-white/50 text-xs">
                    {r.label}
                  </td>
                  <td
                    className={`py-2.5 text-left pl-4 font-bold font-mono ${p2Color}`}
                  >
                    {fmtVal(r.p2, r.suffix, r.decimals)}
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

// ============================================================================
// 10. TENNIS FINALS & TITLES — affiché uniquement si SF / Final
// ============================================================================

export function TennisFinalsTitlesSection({
  data,
}: {
  data: DossierPickData;
}) {
  if (!data.tennisFinalsTitles) return null;

  const p1 = data.tennisFinalsTitles.player1;
  const p2 = data.tennisFinalsTitles.player2;

  if (!p1 && !p2) return null;

  const { player1, player2 } = extractPlayersFromEventName(data.eventName);

  const renderPlayerCard = (
    stats: typeof p1,
    name: string,
    side: "player1" | "player2"
  ) => {
    const accentColor = side === "player1" ? "text-emerald-300" : "text-violet-300";

    if (!stats) {
      return (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <div className={`text-sm font-bold mb-1 ${accentColor}`}>{name}</div>
          <div className="text-xs text-white/40">Pas de données disponibles</div>
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
        <div className={`text-sm font-bold mb-4 ${accentColor}`}>{name}</div>

        {/* Titres */}
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-700/5 border border-amber-500/20 rounded-lg p-3 mb-3">
          <div className="text-xs text-amber-300 font-bold uppercase tracking-wider mb-2">
            🏆 Titres
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="text-3xl font-black text-amber-300 font-mono">
                {stats.total_titles}
              </div>
              <div className="text-[10px] text-white/50 uppercase mt-0.5">
                Total ATP/WTA
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-amber-200 font-mono">
                {stats.grand_slam_titles}
              </div>
              <div className="text-[10px] text-white/50 uppercase mt-0.5">
                Grand Chelem
              </div>
            </div>
          </div>
        </div>

        {/* Finales */}
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-xs text-white/60 font-bold uppercase tracking-wider mb-2">
            Finales jouées
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-black text-white font-mono">
                {stats.total_finals}
              </div>
              <div className="text-[9px] text-white/40 uppercase mt-0.5">
                Total
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-emerald-300 font-mono">
                {stats.finals_won}
              </div>
              <div className="text-[9px] text-white/40 uppercase mt-0.5">
                Gagnées
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-red-300 font-mono">
                {stats.finals_lost}
              </div>
              <div className="text-[9px] text-white/40 uppercase mt-0.5">
                Perdues
              </div>
            </div>
          </div>
          {stats.finals_win_pct !== null && (
            <div className="mt-3 text-center">
              <div className="text-[10px] text-white/40 uppercase mb-1">
                Taux de réussite en finale
              </div>
              <div
                className={`text-2xl font-black font-mono ${
                  stats.finals_win_pct >= 60
                    ? "text-emerald-300"
                    : stats.finals_win_pct >= 40
                      ? "text-amber-300"
                      : "text-red-300"
                }`}
              >
                {fmtPct(stats.finals_win_pct, 1)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-gradient-to-br from-amber-950/30 via-zinc-950 to-amber-950/20 border border-amber-500/20 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🏆</div>
        <div>
          <h2 className="text-xl font-bold text-white">
            Argument psychologique : finales & titres
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            L'expérience en haut tableau pèse en demi-finale et finale
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPlayerCard(p1, player1, "player1")}
        {renderPlayerCard(p2, player2, "player2")}
      </div>
    </section>
  );
}

// ============================================================================
// 11. RUGBY STATS — Top 14, 6 Nations, Coupe d'Europe
// ============================================================================

export function RugbyStatsSection({ data }: { data: DossierPickData }) {
  if (!data.rugbyStats) return null;

  const home = data.rugbyStats.home;
  const away = data.rugbyStats.away;

  // Vérifie qu'on a au moins quelques data
  const hasData =
    home.classement_position !== null ||
    home.victoires !== null ||
    away.classement_position !== null ||
    away.victoires !== null;
  if (!hasData) return null;

  const rows: { label: string; h: string; a: string }[] = [
    {
      label: "Position classement",
      h: fmtNum(home.classement_position),
      a: fmtNum(away.classement_position),
    },
    {
      label: "Bilan (V-N-D)",
      h: `${fmtNum(home.victoires)}-${fmtNum(home.nuls)}-${fmtNum(home.defaites)}`,
      a: `${fmtNum(away.victoires)}-${fmtNum(away.nuls)}-${fmtNum(away.defaites)}`,
    },
    {
      label: "Pts marqués / match",
      h: fmtNum(home.points_marques_avg, 1),
      a: fmtNum(away.points_marques_avg, 1),
    },
    {
      label: "Pts encaissés / match",
      h: fmtNum(home.points_encaisses_avg, 1),
      a: fmtNum(away.points_encaisses_avg, 1),
    },
    {
      label: "Essais / match",
      h: fmtNum(home.essais_marques_avg, 2),
      a: fmtNum(away.essais_marques_avg, 2),
    },
    {
      label: "Forme 5 derniers",
      h: home.forme_5_derniers ?? "—",
      a: away.forme_5_derniers ?? "—",
    },
    {
      label: "Bilan domicile",
      h: home.domicile_record ?? "—",
      a: "—",
    },
    {
      label: "Bilan extérieur",
      h: "—",
      a: away.exterieur_record ?? "—",
    },
  ].filter((r) => r.h !== "—" || r.a !== "—");

  const homeShort = data.homeTeam.split(" ").slice(-1)[0];
  const awayShort = data.awayTeam.split(" ").slice(-1)[0];

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🏉</div>
        <div>
          <h2 className="text-xl font-bold text-white">Stats des 2 équipes</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Performance saison en cours · forme récente
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 text-right pr-4 font-medium">{homeShort}</th>
              <th className="pb-3 text-center font-medium">Stat</th>
              <th className="pb-3 text-left pl-4 font-medium">{awayShort}</th>
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
// 12. HANDBALL STATS — Starligue, EHF
// ============================================================================

export function HandballStatsSection({ data }: { data: DossierPickData }) {
  if (!data.handballStats) return null;

  const home = data.handballStats.home;
  const away = data.handballStats.away;

  const hasData =
    home.classement_position !== null ||
    home.victoires !== null ||
    away.classement_position !== null ||
    away.victoires !== null;
  if (!hasData) return null;

  const rows: { label: string; h: string; a: string }[] = [
    {
      label: "Position classement",
      h: fmtNum(home.classement_position),
      a: fmtNum(away.classement_position),
    },
    {
      label: "Bilan (V-N-D)",
      h: `${fmtNum(home.victoires)}-${fmtNum(home.nuls)}-${fmtNum(home.defaites)}`,
      a: `${fmtNum(away.victoires)}-${fmtNum(away.nuls)}-${fmtNum(away.defaites)}`,
    },
    {
      label: "Buts marqués / match",
      h: fmtNum(home.buts_marques_avg, 1),
      a: fmtNum(away.buts_marques_avg, 1),
    },
    {
      label: "Buts encaissés / match",
      h: fmtNum(home.buts_encaisses_avg, 1),
      a: fmtNum(away.buts_encaisses_avg, 1),
    },
    {
      label: "Différentiel moyen",
      h: fmtNum(home.diff_buts_avg, 1),
      a: fmtNum(away.diff_buts_avg, 1),
    },
    {
      label: "Forme 5 derniers",
      h: home.forme_5_derniers ?? "—",
      a: away.forme_5_derniers ?? "—",
    },
    {
      label: "Top scorer",
      h: home.top_scorer ?? "—",
      a: away.top_scorer ?? "—",
    },
  ].filter((r) => r.h !== "—" || r.a !== "—");

  const homeShort = data.homeTeam.split(" ").slice(-1)[0];
  const awayShort = data.awayTeam.split(" ").slice(-1)[0];

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🤾</div>
        <div>
          <h2 className="text-xl font-bold text-white">Stats des 2 équipes</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Performance saison · efficacité offensive et défensive
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-white/50 uppercase tracking-wider border-b border-zinc-800">
              <th className="pb-3 text-right pr-4 font-medium">{homeShort}</th>
              <th className="pb-3 text-center font-medium">Stat</th>
              <th className="pb-3 text-left pl-4 font-medium">{awayShort}</th>
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
// 13. F1 RACE — données GP + grille de départ
// ============================================================================

export function F1RaceSection({ data }: { data: DossierPickData }) {
  if (!data.f1Race) return null;

  const race = data.f1Race;
  const drivers = data.f1Drivers ?? [];

  // Trier les pilotes par qualifying_position (ASC) — la pole en premier
  const driversSorted = [...drivers].sort((a, b) => {
    const posA = a.qualifying_position ?? 999;
    const posB = b.qualifying_position ?? 999;
    return posA - posB;
  });

  const renderDriverRow = (d: F1DriverStats) => {
    const pos = d.qualifying_position;
    const positionColor =
      pos === 1
        ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
        : pos === 2
          ? "text-zinc-300 bg-zinc-500/10 border-zinc-500/30"
          : pos === 3
            ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
            : "text-white/60 bg-zinc-900 border-zinc-800";

    // Forme récente
    const recentColor =
      d.last_3_races_positions.length > 0
        ? d.last_3_races_positions.every((p) => p <= 5)
          ? "text-emerald-300"
          : d.last_3_races_positions.every((p) => p > 10)
            ? "text-red-300"
            : "text-white"
        : "text-white/40";

    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-3">
        <div className="flex items-center gap-3 mb-2">
          {pos !== null && (
            <span
              className={`px-2.5 py-1 rounded-lg text-sm font-black border ${positionColor} font-mono shrink-0 min-w-[32px] text-center`}
            >
              P{pos}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {d.driver_name}
            </div>
            <div className="text-xs text-white/50 truncate">{d.constructor}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px] mt-3">
          <div>
            <div className="text-white/40 uppercase">Champ.</div>
            <div className="font-bold font-mono text-white">
              P{fmtNum(d.championship_position)}
            </div>
          </div>
          <div>
            <div className="text-white/40 uppercase">Pts</div>
            <div className="font-bold font-mono text-white">
              {fmtNum(d.championship_points)}
            </div>
          </div>
          <div>
            <div className="text-white/40 uppercase">Wins</div>
            <div className="font-bold font-mono text-white">
              {fmtNum(d.wins_season)}
            </div>
          </div>
        </div>

        {/* 3 derniers GP */}
        {d.last_3_races_positions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="text-[10px] text-white/40 uppercase mb-1">
              3 derniers GP
            </div>
            <div className={`text-sm font-mono font-bold ${recentColor}`}>
              {d.last_3_races_positions.map((p) => `P${p}`).join(" · ")}
            </div>
          </div>
        )}

        {/* Best result on this circuit */}
        {d.best_result_at_circuit && (
          <div className="mt-2 text-[10px] text-amber-300/80">
            🏁 Meilleur ici : {d.best_result_at_circuit}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-3xl">🏎️</div>
        <div>
          <h2 className="text-xl font-bold text-white">{race.race_name}</h2>
          <p className="text-xs text-white/50 mt-0.5">
            {race.circuit} · Round {race.round} · {fmtDate(race.race_date)}
          </p>
        </div>
      </div>

      {/* Infos course */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-[10px] text-white/40 uppercase mb-1">Tours</div>
          <div className="text-lg font-bold text-white font-mono">
            {fmtNum(race.laps_total)}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-[10px] text-white/40 uppercase mb-1">Météo</div>
          <div className="text-sm font-bold text-white truncate">
            {race.weather ?? "—"}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-[10px] text-white/40 uppercase mb-1">
            Qualifs
          </div>
          <div className="text-sm font-bold text-white">
            {race.qualifying_date ? fmtDate(race.qualifying_date) : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
          <div className="text-[10px] text-white/40 uppercase mb-1">Pilotes</div>
          <div className="text-lg font-bold text-white font-mono">
            {drivers.length}
          </div>
        </div>
      </div>

      {/* Vainqueurs récents du circuit */}
      {race.recent_winners && race.recent_winners.length > 0 && (
        <div className="mb-5 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
          <div className="text-xs text-amber-300 font-bold uppercase tracking-wider mb-2">
            🏆 Derniers vainqueurs du circuit
          </div>
          <div className="flex flex-wrap gap-2">
            {race.recent_winners.slice(0, 5).map((w, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-zinc-900/80 rounded text-xs text-white/80"
              >
                <span className="font-mono text-amber-300/80 mr-1">
                  {w.year}
                </span>
                {w.driver}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grille de départ + stats pilotes */}
      {driversSorted.length > 0 && (
        <div>
          <div className="text-xs text-white/60 font-bold uppercase tracking-wider mb-3">
            Grille de départ
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {driversSorted.slice(0, 12).map((d, i) => (
              <div key={i}>{renderDriverRow(d)}</div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}