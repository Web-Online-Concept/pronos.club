// src/app/[locale]/(public)/pronos-abonnes/concours/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import PronosAbonnesNav from "@/components/tipster/PronosAbonnesNav";

type RankingEntry = {
  rank?: number;
  user_id: string;
  pseudo: string;
  avatar_url: string | null;
  total_picks: number;
  total_units: number;
  eligible: boolean;
};

type PeriodData = {
  period_start: string;
  period_end: string;
  min_picks: number;
  prize: number;
  ranking: RankingEntry[];
  non_eligible: RankingEntry[];
};

type Winner = {
  id: string;
  user_id: string;
  period_type: "week" | "month";
  period_start: string;
  period_end: string;
  total_units: number;
  picks_count: number;
  prize_amount: number;
  paid: boolean;
  users: { pseudo: string; avatar_url: string | null } | null;
};

export default function ConcoursPage() {
  const locale = useLocale();
  const [tab, setTab] = useState<"current" | "history">("current");
  const [current, setCurrent] = useState<{ week: PeriodData; month: PeriodData } | null>(null);
  const [history, setHistory] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    const [curRes, histRes] = await Promise.all([
      fetch("/api/tipster-concours?action=current"),
      fetch("/api/tipster-concours?action=history"),
    ]);
    const curData = await curRes.json();
    const histData = await histRes.json();
    setCurrent({ week: curData.week, month: curData.month });
    setHistory(histData.winners || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  function formatPeriod(start: string, end: string, type: "week" | "month") {
    const s = new Date(start);
    const e = new Date(end);
    if (type === "month") {
      return s.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    return `${s.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  function Podium({ data, type }: { data: PeriodData; type: "week" | "month" }) {
    const top = data.ranking.slice(0, 3);
    const isWeek = type === "week";
    const color = isWeek ? "#10b981" : "#f59e0b";

    const cardStyle = isWeek
      ? { background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" }
      : { background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)" };

    const borderClass = isWeek ? "border-emerald-300" : "border-amber-300";

    return (
      <div className={`rounded-3xl border-2 ${borderClass} p-6 shadow-md`} style={cardStyle}>
        <div className="text-center mb-6">
          <div className="inline-block rounded-full px-4 py-1" style={{ background: isWeek ? "rgba(16,185,129,0.2)" : "rgba(251,191,36,0.2)", color: isWeek ? "#047857" : "#92400e" }}>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em]">
              {isWeek ? `🏆 Semaine ${getISOWeek(new Date(data.period_start))}` : "👑 Mois"}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-black text-neutral-900">
            {formatPeriod(data.period_start, data.period_end, type)}
          </h3>
          <p className="mt-1 text-xs text-neutral-600">
            Minimum {data.min_picks} picks · Gain : <span className="font-extrabold" style={{ color }}>{data.prize}€</span>
          </p>
        </div>

        {top.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500">
            Aucun tipster éligible pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {top.map((entry, i) => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 rounded-xl p-3 ${
                  i === 0 ? "bg-white border-2 border-amber-400 shadow" :
                  "bg-white border border-neutral-200"
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-black ${
                  i === 0 ? "bg-amber-400 text-amber-900" :
                  i === 1 ? "bg-neutral-200 text-neutral-700" :
                  "bg-orange-200 text-orange-800"
                }`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                </span>
                <Link
                  href={`/${locale}/pronos-abonnes/${encodeURIComponent(entry.pseudo)}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2">
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600">
                        {entry.pseudo.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-extrabold text-neutral-900 truncate">{entry.pseudo}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {entry.total_picks} picks
                  </p>
                </Link>
                <span className={`text-lg font-extrabold tabular-nums ${
                  entry.total_units > 0 ? "text-emerald-600" : entry.total_units < 0 ? "text-red-600" : "text-neutral-500"
                }`}>
                  {entry.total_units >= 0 ? "+" : ""}{entry.total_units.toFixed(2)}U
                </span>
              </div>
            ))}
          </div>
        )}

        {data.ranking.length > 3 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-bold text-neutral-600 hover:text-neutral-900">
              Voir tous les éligibles ({data.ranking.length})
            </summary>
            <div className="mt-2 space-y-1">
              {data.ranking.slice(3).map((entry) => (
                <div key={entry.user_id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-white/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500 w-5">{entry.rank}</span>
                    <Link
                      href={`/${locale}/pronos-abonnes/${encodeURIComponent(entry.pseudo)}`}
                      className="text-sm font-bold text-neutral-800 hover:text-emerald-700"
                    >
                      {entry.pseudo}
                    </Link>
                    <span className="text-[10px] text-neutral-500">({entry.total_picks} picks)</span>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${
                    entry.total_units > 0 ? "text-emerald-700" : entry.total_units < 0 ? "text-red-600" : "text-neutral-500"
                  }`}>
                    {entry.total_units >= 0 ? "+" : ""}{entry.total_units.toFixed(2)}U
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {data.non_eligible.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-neutral-500 hover:text-neutral-900">
              Non éligibles ({data.non_eligible.length}) — pas assez de picks
            </summary>
            <div className="mt-2 space-y-1">
              {data.non_eligible.map((entry) => (
                <div key={entry.user_id} className="flex items-center justify-between py-1.5 px-3 text-neutral-500">
                  <span className="text-xs">
                    {entry.pseudo} <span className="text-red-500">({entry.total_picks}/{data.min_picks} picks)</span>
                  </span>
                  <span className="text-xs tabular-nums">
                    {entry.total_units >= 0 ? "+" : ""}{entry.total_units.toFixed(2)}U
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div
        className="px-4 py-10 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            🏆 Pronos Abonnés
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Concours des tipsters</h1>
          <p className="mt-3 text-base text-white/70">
            Deviens le meilleur tipster de la semaine ou du mois et empoche <strong className="text-amber-400">jusqu&apos;à 40€</strong>.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <div className="rounded-xl bg-white/5 border border-emerald-500/30 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">Semaine</p>
              <p className="mt-1 text-2xl font-black text-white">10€</p>
              <p className="text-[10px] text-white/50">min. 3 picks</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-amber-500/30 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">Mois</p>
              <p className="mt-1 text-2xl font-black text-white">40€</p>
              <p className="text-[10px] text-white/50">min. 10 picks</p>
            </div>
          </div>
        </div>
      </div>

      <PronosAbonnesNav active="concours" locale={locale} />

      {/* Tab */}
      <div className="bg-neutral-50 border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex justify-center gap-2 flex-wrap">
            <button
              onClick={() => setTab("current")}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                tab === "current" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-400"
              }`}
            >
              Concours en cours
            </button>
            <button
              onClick={() => setTab("history")}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                tab === "history" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-400"
              }`}
            >
              🏅 Anciens gagnants
            </button>
            <Link
              href={`/${locale}/pronos-abonnes/fonctionnement`}
              className="rounded-xl bg-white text-neutral-600 border border-neutral-200 hover:border-emerald-400 hover:text-emerald-600 px-4 py-2.5 text-sm font-bold transition"
            >
              📚 Fonctionnement →
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : tab === "current" && current ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Podium data={current.week} type="week" />
            <Podium data={current.month} type="month" />
          </div>
        ) : tab === "history" ? (
          history.length === 0 ? (
            <div className="rounded-3xl bg-neutral-50 py-16 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
                <span className="text-4xl">🏅</span>
              </div>
              <p className="text-neutral-500 text-sm">
                Aucun gagnant pour le moment. Sois le premier à gagner !
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((w) => (
                <div key={w.id} className="flex items-center gap-4 rounded-2xl bg-white border border-neutral-200 p-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${
                    w.period_type === "week" ? "bg-emerald-100" : "bg-amber-100"
                  }`}>
                    {w.period_type === "week" ? "🏆" : "👑"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {w.users?.avatar_url ? (
                        <img src={w.users.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600">
                          {(w.users?.pseudo || "T").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <Link
                        href={`/${locale}/pronos-abonnes/${encodeURIComponent(w.users?.pseudo || "")}`}
                        className="font-extrabold text-neutral-900 hover:text-emerald-600 truncate"
                      >
                        {w.users?.pseudo || "?"}
                      </Link>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {w.period_type === "week" ? `Semaine ${getISOWeek(new Date(w.period_start))}` : "Mois"} : {formatPeriod(w.period_start, w.period_end, w.period_type)}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      +{w.total_units}U · {w.picks_count} picks
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${
                      w.period_type === "week" ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {w.prize_amount}€
                    </p>
                    {w.paid ? (
                      <span className="inline-block mt-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                        ✓ Payé
                      </span>
                    ) : (
                      <span className="inline-block mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                        En attente
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}

      </div>
    </main>
  );
}