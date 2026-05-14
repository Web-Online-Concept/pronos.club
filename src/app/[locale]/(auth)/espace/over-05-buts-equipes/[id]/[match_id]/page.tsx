"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import ScoreBreakdown from "@/components/o05/ScoreBreakdown";
import PsychoSection from "@/components/o05/PsychoSection";

// ─── Types ───────────────────────────────────────────────────────

type MatchDetail = {
  id: string;
  api_football_fixture_id: number | null;
  match_date: string;
  home_team_id: number;
  away_team_id: number;
  target_team_id: number;
  target_role: "home" | "away";
  attack_xg_weighted: number | null;
  attack_tc_weighted: number | null;
  attack_go_weighted: number | null;
  attack_goals_weighted: number | null;
  attack_efficiency: number | null;
  attack_score: number | null;
  attack_bonus_projet: number | null;
  defense_xgc_weighted: number | null;
  defense_tc_subis_weighted: number | null;
  defense_go_conceded_weighted: number | null;
  defense_goals_conceded_weighted: number | null;
  defense_clean_sheets: number | null;
  defense_score: number | null;
  defense_bonus_projet: number | null;
  matchup_bonus: number | null;
  home_bonus: number | null;
  closed_match_malus: number | null;
  total_score: number | null;
  note_10: number | null;
  verdict: "TRÈS BON" | "BON" | "MOYEN" | "FAIBLE" | null;
  data_source: string | null;
  data_quality: "complete" | "partial" | "missing" | null;
  raw_data: {
    favori_reason?: string;
    target_matches?: ProcessedMatch[];
    opponent_matches?: ProcessedMatch[];
  } | null;
  error_message: string | null;
  analysis: {
    id: string;
    league_id: number;
    matchday_label: string | null;
  };
  home_team: { id: number; name: string };
  away_team: { id: number; name: string };
  target_team: { id: number; name: string };
};

type ProcessedMatch = {
  match_date: string;
  opponent_name: string;
  opponent_category: string | null;
  is_home: boolean;
  xg_for: number;
  shots_on_target_for: number;
  big_chances_for: number;
  goals_for: number;
  xg_against: number;
  shots_on_target_against: number;
  big_chances_against: number;
  goals_against: number;
  clean_sheet: boolean;
};

type TeamProject = {
  category: string | null;
  avg_rank_historical: number | null;
  current_rank: number | null;
};

type Bet = {
  id: string;
  played: boolean;
  stake_amount: number | null;
  odds: number;
  bet_status: "pending" | "won" | "lost";
  target_team_scored: boolean | null;
  profit: number | null;
  psycho_flags: Record<string, boolean> | null;
  psycho_notes: string | null;
};


// ─── Page ────────────────────────────────────────────────────────

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string; match_id: string }>;
}) {
  const { id: analysisId, match_id: matchId } = use(params);
  const locale = useLocale();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [projects, setProjects] = useState<Record<number, TeamProject>>({});
  const [bet, setBet] = useState<Bet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Load ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/over-05/match/${matchId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setMatch(json.match);
        setProjects(json.projects ?? {});
        setBet(json.bet);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [matchId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </main>
    );
  }

  if (error || !match) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/${locale}/espace/over-05-buts-equipes/${analysisId}`}
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Retour
        </Link>
        <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-6 text-center">
          <p className="text-red-600">{error ?? "Match introuvable"}</p>
        </div>
      </main>
    );
  }

  // Cas erreur (match analysé mais avec error_message)
  if (match.error_message && !match.verdict) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/${locale}/espace/over-05-buts-equipes/${analysisId}`}
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Retour aux résultats
        </Link>
        <div className="mt-6 rounded-xl border border-yellow-300 bg-yellow-50 p-6">
          <h2 className="text-base font-black text-yellow-800">
            ⚠️ Analyse non disponible
          </h2>
          <p className="mt-2 text-sm text-yellow-700">
            {match.home_team.name} vs {match.away_team.name}
          </p>
          <p className="mt-3 text-xs text-yellow-600">{match.error_message}</p>
        </div>
      </main>
    );
  }

  const targetProject = projects[match.target_team_id];
  const opponentTeamId =
    match.target_role === "home" ? match.away_team_id : match.home_team_id;
  const opponentProject = projects[opponentTeamId];
  const opponentTeam =
    match.target_role === "home" ? match.away_team : match.home_team;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <Link
        href={`/${locale}/espace/over-05-buts-equipes/${analysisId}`}
        className="inline-flex items-center gap-2 text-sm text-neutral-600 transition hover:text-neutral-900"
      >
        ← Retour aux résultats
      </Link>

      <div className="mt-4">
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span>{formatDate(match.match_date)}</span>
          {match.data_quality === "partial" && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">
              ⚠️ Données partielles
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-900">
          {match.home_team.name}{" "}
          <span className="text-neutral-400">vs</span>{" "}
          {match.away_team.name}
        </h1>
      </div>

      {/* Encart CIBLE */}
      <div
        className="mt-6 overflow-hidden rounded-xl border border-white/[0.06] p-5"
        style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-emerald-400/80">
              🎯 Cible (favori intrinsèque)
            </p>
            <p className="mt-1 text-xl font-black text-white">{match.target_team.name}</p>
            <p className="mt-1 text-xs text-white/40">
              {targetProject?.category && (
                <>Catégorie : <span className="font-bold">{targetProject.category}</span></>
              )}
              {targetProject?.avg_rank_historical != null && (
                <> · Moyenne historique : <span className="font-bold">{targetProject.avg_rank_historical}</span></>
              )}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-white/40">Adversaire</p>
            <p className="text-base font-bold text-white">{opponentTeam.name}</p>
            <p className="mt-1 text-xs text-white/40">
              {opponentProject?.category && (
                <>{opponentProject.category}</>
              )}
              {opponentProject?.avg_rank_historical != null && (
                <> · {opponentProject.avg_rank_historical}</>
              )}
            </p>
          </div>
        </div>
        {match.raw_data?.favori_reason && (
          <p className="mt-3 rounded-md bg-white/5 px-3 py-2 text-xs text-white/60">
            💡 {match.raw_data.favori_reason}
          </p>
        )}
      </div>

      {/* Décomposition du score */}
      <div className="mt-6">
        <ScoreBreakdown
          attackScore={match.attack_score}
          attackXg={match.attack_xg_weighted}
          attackTc={match.attack_tc_weighted}
          attackGo={match.attack_go_weighted}
          attackEfficiency={match.attack_efficiency}
          attackBonusProjet={match.attack_bonus_projet}
          defenseScore={match.defense_score}
          defenseXgc={match.defense_xgc_weighted}
          defenseTcSubis={match.defense_tc_subis_weighted}
          defenseGoConceded={match.defense_go_conceded_weighted}
          defenseCleanSheets={match.defense_clean_sheets}
          defenseBonusProjet={match.defense_bonus_projet}
          matchupBonus={match.matchup_bonus}
          homeBonus={match.home_bonus}
          closedMatchMalus={match.closed_match_malus}
          totalScore={match.total_score}
          note10={match.note_10}
          verdict={match.verdict}
        />
      </div>

      {/* Tableau 3 derniers matchs CIBLE */}
      {match.raw_data?.target_matches && match.raw_data.target_matches.length > 0 && (
        <MatchesTable
          title={`📈 3 derniers matchs de ${match.target_team.name}`}
          matches={match.raw_data.target_matches}
          mode="attack"
        />
      )}

      {/* Tableau 3 derniers matchs ADVERSAIRE */}
      {match.raw_data?.opponent_matches && match.raw_data.opponent_matches.length > 0 && (
        <MatchesTable
          title={`📉 3 derniers matchs de ${opponentTeam.name}`}
          matches={match.raw_data.opponent_matches}
          mode="defense"
        />
      )}

      {/* Module PSYCHO */}
      <div className="mt-6">
        <PsychoSection
          matchId={match.id}
          initialNotes={bet?.psycho_notes ?? null}
          initialFlags={bet?.psycho_flags ?? null}
        />
      </div>

      {/* Section PARI */}
      <div className="mt-6">
        <BetSection matchId={match.id} initialBet={bet} onBetUpdated={setBet} />
      </div>
    </main>
  );
}


// ─── Tableau 3 derniers matchs ───────────────────────────────────

function MatchesTable({
  title,
  matches,
  mode,
}: {
  title: string;
  matches: ProcessedMatch[];
  mode: "attack" | "defense";
}) {
  return (
    <div
      className="mt-6 overflow-hidden rounded-xl border border-white/[0.06] p-5"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <h3 className="text-base font-black text-white">{title}</h3>
      <p className="mt-1 text-xs text-white/40">
        Du plus récent au moins récent · Pondération M-3 × 1.5, M-2 × 1.2, M-1 × 1.0
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/40">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Adversaire</th>
              <th className="py-2 pr-3">Cat.</th>
              <th className="py-2 pr-3 text-center">Lieu</th>
              {mode === "attack" ? (
                <>
                  <th className="py-2 pr-3 text-right">xG</th>
                  <th className="py-2 pr-3 text-right">TC</th>
                  <th className="py-2 pr-3 text-right">GO</th>
                  <th className="py-2 pl-3 text-right">Buts</th>
                </>
              ) : (
                <>
                  <th className="py-2 pr-3 text-right">xGC</th>
                  <th className="py-2 pr-3 text-right">TC sub.</th>
                  <th className="py-2 pr-3 text-right">GO sub.</th>
                  <th className="py-2 pl-3 text-right">Encaiss.</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <tr key={i} className="border-b border-white/5 text-white/80">
                <td className="py-2 pr-3 text-white/60">{shortDate(m.match_date)}</td>
                <td className="py-2 pr-3 font-bold text-white">{m.opponent_name}</td>
                <td className="py-2 pr-3 text-white/60">
                  {m.opponent_category ?? "—"}
                </td>
                <td className="py-2 pr-3 text-center">
                  {m.is_home ? "🏠" : "✈️"}
                </td>
                {mode === "attack" ? (
                  <>
                    <td className="py-2 pr-3 text-right">{m.xg_for.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right">{m.shots_on_target_for}</td>
                    <td className="py-2 pr-3 text-right">{m.big_chances_for}</td>
                    <td className="py-2 pl-3 text-right font-bold text-emerald-400">
                      {m.goals_for}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 pr-3 text-right">{m.xg_against.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right">{m.shots_on_target_against}</td>
                    <td className="py-2 pr-3 text-right">{m.big_chances_against}</td>
                    <td className="py-2 pl-3 text-right font-bold text-red-400">
                      {m.goals_against}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─── Section Pari ────────────────────────────────────────────────

function BetSection({
  matchId,
  initialBet,
  onBetUpdated,
}: {
  matchId: string;
  initialBet: Bet | null;
  onBetUpdated: (b: Bet | null) => void;
}) {
  const [played, setPlayed] = useState(initialBet?.played ?? false);
  const [stakeAmount, setStakeAmount] = useState(
    initialBet?.stake_amount?.toString() ?? ""
  );
  const [odds, setOdds] = useState(initialBet?.odds?.toString() ?? "1.5");
  const [betStatus, setBetStatus] = useState<"pending" | "won" | "lost">(
    initialBet?.bet_status ?? "pending"
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/over-05/match/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          played,
          stake_amount: stakeAmount ? parseFloat(stakeAmount) : null,
          odds: parseFloat(odds),
          bet_status: betStatus,
          target_team_scored:
            betStatus === "won" ? true : betStatus === "lost" ? false : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Erreur : " + (err.error || res.status));
        return;
      }
      setSavedAt(new Date());
      // Recharger le bet pour avoir le profit calculé
      const refetch = await fetch(`/api/over-05/match/${matchId}`);
      if (refetch.ok) {
        const json = await refetch.json();
        onBetUpdated(json.bet);
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] p-6"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <h3 className="text-base font-black text-white">💰 Mon pari</h3>

      {/* Statut */}
      {initialBet?.bet_status === "won" && (
        <div className="mt-3 rounded-lg bg-emerald-500/20 px-3 py-2 text-sm text-emerald-300">
          ✅ Pari gagné · Profit : <strong>+{initialBet.profit?.toFixed(2)}€</strong>
        </div>
      )}
      {initialBet?.bet_status === "lost" && (
        <div className="mt-3 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">
          ❌ Pari perdu · Perte : <strong>{initialBet.profit?.toFixed(2)}€</strong>
        </div>
      )}

      {/* Played toggle */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setPlayed(true)}
          className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition ${
            played
              ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
              : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
          }`}
        >
          💰 J&apos;ai parié
        </button>
        <button
          onClick={() => setPlayed(false)}
          className={`flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition ${
            !played
              ? "border-neutral-500 bg-neutral-500/20 text-neutral-300"
              : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
          }`}
        >
          👋 Pas joué
        </button>
      </div>

      {played && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                Mise (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="10"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-white/60">
                Cote
              </label>
              <input
                type="number"
                step="0.01"
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder="1.50"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Résolution */}
          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-white/60">
              Résolution
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["pending", "won", "lost"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setBetStatus(status)}
                  className={`rounded-xl border-2 px-3 py-2 text-xs font-bold transition ${
                    betStatus === status
                      ? status === "won"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : status === "lost"
                        ? "border-red-500 bg-red-500/20 text-red-300"
                        : "border-white/40 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                  }`}
                >
                  {status === "pending" ? "⏳ En attente" : status === "won" ? "✅ Gagné" : "❌ Perdu"}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Save */}
      <div className="mt-5 flex items-center justify-between">
        {savedAt && (
          <span className="text-xs text-emerald-400">
            ✓ Enregistré à {savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "..." : "💾 Enregistrer"}
        </button>
      </div>
    </div>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortDate(isoOrSpace: string): string {
  // Understat utilise "2026-05-10 17:00:00", on prend juste la date
  const datePart = isoOrSpace.split(" ")[0] ?? isoOrSpace.split("T")[0] ?? isoOrSpace;
  try {
    const d = new Date(datePart + "T12:00:00");
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  } catch {
    return datePart;
  }
}