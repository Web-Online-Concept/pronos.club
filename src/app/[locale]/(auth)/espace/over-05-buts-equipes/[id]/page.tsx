"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";

type LineDetail = {
  opponent_name: string;
  opponent_intrinsic: number | null;
  match_date: string;
  goals_team: number;
  goals_opponent: number;
  pts5_opponent: number | null;
  env_letter: string | null;
  ad_letter: string | null;
  score_line: number;
  anomaly_value: number;
};

type Opportunity = {
  id: string;
  fixture_id: number;
  match_date: string;
  home_team_name: string;
  away_team_name: string;
  target_team_name: string;
  target_role: "home" | "away";
  opponent_team_name: string;
  stake_score: number;
  stake_situations: Array<{ type: string; detail: string; gap_points: number }> | null;
  target_intrinsic: number;
  opponent_intrinsic: number;
  level_gap: number;
  target_form_score: number;
  opponent_fragility_score: number;
  total_score: number;
  badge: "green" | "orange" | "red";
  bertrand_decision: "play" | "skip" | "pending" | null;
  excel_details: {
    favori_details?: LineDetail[];
    outsider_details?: LineDetail[];
    anomalies_total?: number;
  } | null;
  o05_leagues: { name: string; country: string } | null;
};

const BADGE_BG: Record<string, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
};

const BADGE_LABEL: Record<string, string> = {
  green: "🟢 Vert · Forte confiance",
  orange: "🟠 Orange · Modéré",
  red: "🔴 Rouge · Faible",
};


export default function OpportunityDetailPage() {
  const locale = useLocale();
  const params = useParams();
  const id = params?.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decision & bet inputs
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [showPlayForm, setShowPlayForm] = useState(false);
  const [stakeAmount, setStakeAmount] = useState<string>("");
  const [oddsValue, setOddsValue] = useState<string>("1.50");
  const [betNotes, setBetNotes] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    fetchOpportunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchOpportunity() {
    setLoading(true);
    try {
      const dates: string[] = [];
      for (let i = 0; i < 3; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
        dates.push(d);
      }

      let found: Opportunity | null = null;
      for (const date of dates) {
        const res = await fetch(`/api/over-05-buts-equipes/opportunities?badge=all&date=${date}`);
        if (!res.ok) continue;
        const data = await res.json();
        const match = (data.opportunities ?? []).find((o: Opportunity) => o.id === id);
        if (match) {
          found = match;
          break;
        }
      }

      if (!found) {
        throw new Error("Opportunité introuvable");
      }
      setOpportunity(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(decision: "play" | "skip" | "pending") {
    if (!opportunity) return;

    if (decision === "play") {
      setShowPlayForm(true);
      return;
    }

    setDecisionLoading(true);
    try {
      const res = await fetch("/api/over-05-buts-equipes/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: opportunity.id,
          bertrand_decision: decision,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Erreur : " + (err.error || res.status));
        return;
      }
      await fetchOpportunity();
    } finally {
      setDecisionLoading(false);
    }
  }

  async function handleConfirmBet() {
    if (!opportunity) return;

    const stake = parseFloat(stakeAmount);
    const odds = parseFloat(oddsValue);

    if (isNaN(stake) || stake <= 0) {
      alert("Mise invalide");
      return;
    }
    if (isNaN(odds) || odds < 1.01) {
      alert("Cote invalide (minimum 1.01)");
      return;
    }

    setDecisionLoading(true);
    try {
      const res = await fetch("/api/over-05-buts-equipes/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: opportunity.id,
          stake_amount: stake,
          odds: odds,
          user_notes: betNotes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Erreur : " + (err.error || res.status));
        return;
      }
      setShowPlayForm(false);
      await fetchOpportunity();
    } finally {
      setDecisionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </main>
    );
  }

  if (error || !opportunity) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <p className="text-neutral-600">⚠️ {error || "Introuvable"}</p>
          <Link
            href={`/${locale}/espace/over-05-buts-equipes`}
            className="mt-4 inline-block text-emerald-600 hover:underline"
          >
            ← Retour à la liste
          </Link>
        </div>
      </main>
    );
  }

  const matchDate = new Date(opportunity.match_date);
  const targetIsHome = opportunity.target_role === "home";

  // GARDE-FOUS : sécurise les arrays au cas où null/undefined
  const stakeSituations = opportunity.stake_situations ?? [];
  const favoriDetails = opportunity.excel_details?.favori_details ?? [];
  const outsiderDetails = opportunity.excel_details?.outsider_details ?? [];
  const anomaliesTotal = opportunity.excel_details?.anomalies_total ?? 0;

  return (
    <main className="min-h-screen pb-12 bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Link
            href={`/${locale}/espace/over-05-buts-equipes`}
            className="text-xs text-emerald-600 hover:underline"
          >
            ← Retour à la liste
          </Link>
          <div className="mt-3 flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-600">
                {opportunity.o05_leagues?.country} · {opportunity.o05_leagues?.name}
              </p>
              <h1 className="mt-2 text-2xl font-black text-neutral-900 sm:text-3xl">
                <span className={targetIsHome ? "text-emerald-600" : "text-neutral-900"}>
                  {opportunity.home_team_name}
                </span>
                <span className="mx-3 text-neutral-400">vs</span>
                <span className={!targetIsHome ? "text-emerald-600" : "text-neutral-900"}>
                  {opportunity.away_team_name}
                </span>
              </h1>
              <p className="mt-2 text-sm text-neutral-600">
                {matchDate.toLocaleString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className={`${BADGE_BG[opportunity.badge]} rounded-2xl px-6 py-4 text-center shadow-md`}>
              <p className="text-[10px] font-black uppercase tracking-wider text-white/90">
                Score total
              </p>
              <p className="mt-1 text-4xl font-black text-white">{opportunity.total_score}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/80 mt-0.5">
                {BADGE_LABEL[opportunity.badge]}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Section 1 : Cible */}
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6">
          <h2 className="text-lg font-black text-emerald-800">🎯 Cible du pari</h2>
          <p className="mt-2 text-2xl font-black text-neutral-900">
            {opportunity.target_team_name}
            <span className="ml-3 text-sm font-normal text-neutral-600">marque ≥ 1 but</span>
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Joue {targetIsHome ? "à domicile" : "à l'extérieur"} · favori intrinsèque ({Number(opportunity.target_intrinsic).toFixed(2)} vs {Number(opportunity.opponent_intrinsic).toFixed(2)})
          </p>
        </div>

        {/* Section 2 : Enjeu */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-neutral-900">⚡ Enjeu sportif (Module 1)</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Stake score : {opportunity.stake_score} / 3
          </p>
          <div className="mt-3 space-y-2">
            {stakeSituations.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">Aucune situation détectée</p>
            ) : (
              stakeSituations.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-neutral-50 border border-neutral-100 p-3 text-sm text-neutral-700"
                >
                  <span className="font-bold flex-shrink-0">
                    {s.type === "title" && "🏆"}
                    {s.type === "europe" && "🏅"}
                    {s.type === "relegation" && "⚠️"}
                  </span>
                  <span>{s.detail}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 3 : Niveaux intrinsèques */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-neutral-900">🔬 Niveaux intrinsèques (5 saisons)</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-[10px] uppercase tracking-wider text-emerald-700">FAVORI</p>
              <p className="mt-1 text-sm font-bold text-neutral-900">{opportunity.target_team_name}</p>
              <p className="mt-2 text-3xl font-black text-emerald-600">
                {Number(opportunity.target_intrinsic).toFixed(2)}
              </p>
              <p className="text-[10px] text-neutral-500">plus c&apos;est bas, plus l&apos;équipe est forte</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-[10px] uppercase tracking-wider text-amber-700">OUTSIDER</p>
              <p className="mt-1 text-sm font-bold text-neutral-900">{opportunity.opponent_team_name}</p>
              <p className="mt-2 text-3xl font-black text-amber-600">
                {Number(opportunity.opponent_intrinsic).toFixed(2)}
              </p>
              <p className="text-[10px] text-neutral-500">
                écart : +{Number(opportunity.level_gap).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Section 4 : 5 derniers matchs FAVORI */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-neutral-900">📊 5 derniers matchs du favori</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Score forme {opportunity.target_team_name} :{" "}
            <span className="font-bold text-emerald-600">
              {opportunity.target_form_score}/20
            </span>
          </p>
          <div className="mt-4 overflow-x-auto">
            {favoriDetails.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">Pas de détails disponibles</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="py-2 text-left font-bold">Date</th>
                    <th className="py-2 text-left font-bold">Adversaire</th>
                    <th className="py-2 text-center font-bold">Score</th>
                    <th className="py-2 text-center font-bold">Niv adv.</th>
                    <th className="py-2 text-center font-bold">Pts5</th>
                    <th className="py-2 text-center font-bold">Q</th>
                    <th className="py-2 text-center font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {favoriDetails.map((line, i) => (
                    <tr key={i} className="border-b border-neutral-100 text-neutral-700">
                      <td className="py-2">
                        {new Date(line.match_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="py-2 font-bold text-neutral-900">{line.opponent_name}</td>
                      <td className="py-2 text-center">
                        <span
                          className={
                            line.goals_team > line.goals_opponent
                              ? "text-emerald-600 font-bold"
                              : line.goals_team < line.goals_opponent
                                ? "text-red-600 font-bold"
                                : "text-neutral-500"
                          }
                        >
                          {line.goals_team}-{line.goals_opponent}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        {line.opponent_intrinsic !== null ? Number(line.opponent_intrinsic).toFixed(2) : "?"}
                      </td>
                      <td className="py-2 text-center">{line.pts5_opponent ?? "?"}</td>
                      <td className="py-2 text-center font-bold">{line.ad_letter ?? "-"}</td>
                      <td className="py-2 text-center font-black text-emerald-600">{line.score_line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Section 5 : 5 derniers matchs OUTSIDER */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-neutral-900">📊 5 derniers matchs de l&apos;outsider</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Score fragilité {opportunity.opponent_team_name} :{" "}
            <span className="font-bold text-amber-600">
              {opportunity.opponent_fragility_score}/20
            </span>
          </p>
          <div className="mt-4 overflow-x-auto">
            {outsiderDetails.length === 0 ? (
              <p className="text-xs text-neutral-500 italic">Pas de détails disponibles</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="py-2 text-left font-bold">Date</th>
                    <th className="py-2 text-left font-bold">Adversaire</th>
                    <th className="py-2 text-center font-bold">Score</th>
                    <th className="py-2 text-center font-bold">Niv adv.</th>
                    <th className="py-2 text-center font-bold">Pts5</th>
                    <th className="py-2 text-center font-bold">Q</th>
                    <th className="py-2 text-center font-bold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {outsiderDetails.map((line, i) => (
                    <tr key={i} className="border-b border-neutral-100 text-neutral-700">
                      <td className="py-2">
                        {new Date(line.match_date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="py-2 font-bold text-neutral-900">{line.opponent_name}</td>
                      <td className="py-2 text-center">
                        <span
                          className={
                            line.goals_team > line.goals_opponent
                              ? "text-emerald-600 font-bold"
                              : line.goals_team < line.goals_opponent
                                ? "text-red-600 font-bold"
                                : "text-neutral-500"
                          }
                        >
                          {line.goals_team}-{line.goals_opponent}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        {line.opponent_intrinsic !== null ? Number(line.opponent_intrinsic).toFixed(2) : "?"}
                      </td>
                      <td className="py-2 text-center">{line.pts5_opponent ?? "?"}</td>
                      <td className="py-2 text-center font-bold">{line.ad_letter ?? "-"}</td>
                      <td className="py-2 text-center font-black text-amber-600">{line.score_line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {anomaliesTotal !== 0 && (
            <p className="mt-3 text-xs text-red-600">
              ⚠️ Anomalies détectées : {anomaliesTotal} pts
            </p>
          )}
        </div>

        {/* Section 6 : Décision */}
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6">
          <h2 className="text-lg font-black text-neutral-900">🎲 Ma décision</h2>
          <p className="mt-1 text-xs text-neutral-600">
            Décide de jouer ou non ce pari en live à cote 1.50 environ.
          </p>

          {!showPlayForm && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => handleDecision("play")}
                disabled={decisionLoading}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50 shadow-sm"
              >
                ✓ Je joue
              </button>
              <button
                onClick={() => handleDecision("skip")}
                disabled={decisionLoading}
                className="rounded-xl bg-neutral-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-neutral-600 disabled:opacity-50 shadow-sm"
              >
                ✗ Je passe
              </button>
              <button
                onClick={() => handleDecision("pending")}
                disabled={decisionLoading}
                className="rounded-xl border-2 border-amber-400 bg-amber-100 px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-200 disabled:opacity-50"
              >
                ⏳ En attente
              </button>
            </div>
          )}

          {showPlayForm && (
            <div className="mt-4 space-y-3 rounded-xl bg-white border border-neutral-200 p-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Mise (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="ex: 10.00"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Cote prise
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={oddsValue}
                  onChange={(e) => setOddsValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Notes (optionnel)
                </label>
                <input
                  type="text"
                  value={betNotes}
                  onChange={(e) => setBetNotes(e.target.value)}
                  placeholder="ex: prise live à 70e minute"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPlayForm(false)}
                  className="flex-1 rounded-lg bg-neutral-200 px-4 py-2 text-sm font-bold text-neutral-700 transition hover:bg-neutral-300"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmBet}
                  disabled={decisionLoading}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {decisionLoading ? "..." : "✓ Confirmer pari"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}