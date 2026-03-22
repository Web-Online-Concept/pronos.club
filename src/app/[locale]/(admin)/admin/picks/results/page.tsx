"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Pick, PickLeg, PickStatus } from "@/lib/supabase/types";

const RESULT_BUTTONS = [
  { status: "won", label: "✅ Gagné", color: "bg-emerald-500 hover:bg-emerald-400" },
  { status: "lost", label: "❌ Perdu", color: "bg-red-500 hover:bg-red-400" },
  { status: "void", label: "↩️ Remb.", color: "bg-neutral-400 hover:bg-neutral-300" },
  { status: "half_won", label: "½ Gagné", color: "bg-emerald-300 hover:bg-emerald-200" },
  { status: "half_lost", label: "½ Perdu", color: "bg-red-300 hover:bg-red-200" },
] as const;

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: "⏳ En attente", color: "bg-amber-100 text-amber-700" },
  won: { label: "✅ Gagné", color: "bg-emerald-100 text-emerald-700" },
  lost: { label: "❌ Perdu", color: "bg-red-100 text-red-700" },
  void: { label: "↩️ Remb.", color: "bg-neutral-100 text-neutral-600" },
  half_won: { label: "½ Gagné", color: "bg-emerald-100 text-emerald-700" },
  half_lost: { label: "½ Perdu", color: "bg-red-100 text-red-700" },
};

interface PickWithLegs extends Pick {
  legs?: PickLeg[];
}

export default function ResultsPage() {
  const [picks, setPicks] = useState<PickWithLegs[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchPending();
  }, []);

  async function fetchPending() {
    setLoading(true);
    const res = await fetch("/api/picks?status=pending&include_legs=true");
    const { data } = await res.json();
    setPicks(data ?? []);
    setLoading(false);
  }

  // Simple pick result
  async function setResult(pickId: string, status: string) {
    setUpdating(pickId);

    const res = await fetch(`/api/picks/${pickId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      setPicks((prev) => prev.filter((p) => p.id !== pickId));
    }

    setUpdating(null);
  }

  // Combined leg result
  async function setLegResult(pickId: string, legNumber: number, status: string) {
    setUpdating(`${pickId}-${legNumber}`);

    const res = await fetch(`/api/picks/${pickId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leg_number: legNumber, status }),
    });

    if (res.ok) {
      const data = await res.json();

      if (data.all_resolved) {
        setPicks((prev) => prev.filter((p) => p.id !== pickId));
      } else {
        setPicks((prev) =>
          prev.map((p) => {
            if (p.id !== pickId) return p;
            return {
              ...p,
              legs: (p.legs ?? []).map((l) =>
                l.leg_number === legNumber ? { ...l, status: status as PickStatus } : l
              ),
            };
          })
        );
      }
    }

    setUpdating(null);
  }

  // Reset a resolved leg back to pending (to fix mistakes)
  async function resetLeg(pickId: string, legNumber: number) {
    setUpdating(`${pickId}-${legNumber}`);

    const res = await fetch(`/api/picks/${pickId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leg_number: legNumber, status: "pending" }),
    });

    if (res.ok) {
      setPicks((prev) =>
        prev.map((p) => {
          if (p.id !== pickId) return p;
          return {
            ...p,
            legs: (p.legs ?? []).map((l) =>
              l.leg_number === legNumber ? { ...l, status: "pending" as PickStatus } : l
            ),
          };
        })
      );
    }

    setUpdating(null);
  }

  // Force recalculate combined when all legs resolved but pick still pending
  async function forceResolveCombined(pickId: string) {
    setUpdating(pickId);

    const pick = picks.find((p) => p.id === pickId);
    if (!pick) return;

    const legs = (pick.legs ?? []).sort((a, b) => a.leg_number - b.leg_number);
    const lastLeg = legs[legs.length - 1];

    // Re-send the last leg result to trigger all_resolved calculation
    const res = await fetch(`/api/picks/${pickId}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leg_number: lastLeg.leg_number, status: lastLeg.status }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.all_resolved) {
        setPicks((prev) => prev.filter((p) => p.id !== pickId));
      }
    }

    setUpdating(null);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
          ← Dashboard
        </Link>
        <p className="text-center text-sm text-white/30">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(245,158,11,0.15)" }}>
          <span className="text-lg">✅</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Résultats en attente</h1>
          <p className="text-xs text-white/30">
            {picks.length} pick{picks.length !== 1 ? "s" : ""} en attente
          </p>
        </div>
      </div>

      {picks.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-4xl">🎉</p>
          <p className="mt-2 text-sm text-white/30">Aucun résultat en attente</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {picks.map((pick) => {
            const isCombi = pick.pick_type === "combine" && (pick.legs?.length ?? 0) > 1;
            const legs = (pick.legs ?? []).sort((a, b) => a.leg_number - b.leg_number);
            const allLegsResolved = isCombi && legs.length > 0 && legs.every((l) => l.status !== "pending");

            return (
              <div key={pick.id} className="overflow-hidden rounded-xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}>
                <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{pick.event_name}</p>
                      {isCombi && (
                        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-400">
                          COMBINÉ
                        </span>
                      )}
                    </div>
                    {!isCombi && (
                      <p className="mt-0.5 text-sm text-white/40">{pick.selection}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-emerald-400">{pick.odds}</p>
                    <p className="text-xs text-white/30">{pick.stake}U</p>
                  </div>
                </div>

                <div className="mt-2 flex gap-2 text-xs text-white/25">
                  <span>{pick.sport?.icon} {pick.sport?.name_fr}</span>
                  {pick.competition && (
                    <>
                      <span>•</span>
                      <span>{pick.competition}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>
                    {new Date(pick.event_date).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* SIMPLE — single row of buttons */}
                {!isCombi && (
                  <div className="mt-4 grid grid-cols-5 gap-1.5">
                    {RESULT_BUTTONS.map((btn) => (
                      <button
                        key={btn.status}
                        onClick={() => setResult(pick.id, btn.status)}
                        disabled={updating === pick.id}
                        className={`cursor-pointer rounded-lg px-1 py-2.5 text-xs font-semibold text-white transition ${btn.color} disabled:opacity-30`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* COMBINED — result per leg */}
                {isCombi && (
                  <div className="mt-4 space-y-3">
                    {legs.map((leg) => {
                      const badge = STATUS_BADGE[leg.status] ?? STATUS_BADGE.pending;
                      const isResolved = leg.status !== "pending";

                      return (
                        <div
                          key={leg.leg_number}
                          className={`rounded-lg border p-3 ${isResolved ? "border-white/5 bg-white/[0.02]" : "border-white/10 bg-white/[0.04]"}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-white/25">
                                Sélection {leg.leg_number}
                              </p>
                              <p className="mt-0.5 text-sm font-semibold text-white/80">{leg.event_name}</p>
                              <p className="text-xs text-white/30">{leg.selection} @ {leg.odds}</p>
                            </div>
                            {isResolved && (
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.color}`}>
                                  {badge.label}
                                </span>
                                <button
                                  onClick={() => resetLeg(pick.id, leg.leg_number)}
                                  disabled={updating === `${pick.id}-${leg.leg_number}`}
                                  className="cursor-pointer rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-white/30 transition hover:bg-white/10 hover:text-white/60 disabled:opacity-30"
                                  title="Corriger ce résultat"
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                          </div>

                          {!isResolved && (
                            <div className="mt-2 grid grid-cols-5 gap-1.5">
                              {RESULT_BUTTONS.map((btn) => (
                                <button
                                  key={btn.status}
                                  onClick={() => setLegResult(pick.id, leg.leg_number, btn.status)}
                                  disabled={updating === `${pick.id}-${leg.leg_number}`}
                                  className={`cursor-pointer rounded-lg px-1 py-2 text-[10px] font-semibold text-white transition ${btn.color} disabled:opacity-30`}
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* All legs resolved but pick still pending → force resolve */}
                    {allLegsResolved && (
                      <button
                        onClick={() => forceResolveCombined(pick.id)}
                        disabled={updating === pick.id}
                        className="w-full cursor-pointer rounded-lg bg-purple-600 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:opacity-30"
                      >
                        {updating === pick.id ? "Calcul en cours..." : "✅ Valider le résultat du combiné"}
                      </button>
                    )}
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}