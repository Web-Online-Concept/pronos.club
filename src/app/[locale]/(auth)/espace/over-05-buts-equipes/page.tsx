"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";

// ─── Types ───────────────────────────────────────────────────────

type League = {
  id: number;
  api_football_id: number;
  name: string;
  country: string;
  country_code: string;
  xg_source: "understat" | "sofascore";
  is_top5: boolean;
};

type Matchday = {
  matchday_label: string;
  round_value: string;
  date_from: string;
  date_to: string;
  match_count: number;
  first_match_iso: string;
};

type RecentAnalysis = {
  id: string;
  league_name: string;
  matchday_label: string | null;
  date_from: string;
  total_matches: number;
  matches_analyzed: number;
  status: string;
  created_at: string;
};

// ─── Page ────────────────────────────────────────────────────────

export default function SelectionPage() {
  const router = useRouter();
  const locale = useLocale();

  // États
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leaguesWithProjects, setLeaguesWithProjects] = useState<Set<number>>(new Set());
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<Matchday | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);

  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingMatchdays, setLoadingMatchdays] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Charger les championnats au mount ────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/over-05/leagues");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setLeagues(json.leagues ?? []);

        // Identifier les championnats avec PROJETS seedés
        // Top 5 (Understat) : L1=1, PL=2, La Liga=3, Bundesliga=4, Serie A=5
        // D2 (API-Football, sans xG) : Ligue 2=6, Championship=7, La Liga 2=8,
        //   2. Bundesliga=9, Serie B=10, Eredivisie=11, Liga Portugal=12,
        //   Pro League BE=13, Süper Lig TR=14
        setLeaguesWithProjects(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setLoadingLeagues(false);
      }
    };
    load();
  }, []);

  // ─── Charger les journées quand un championnat est sélectionné ─
  useEffect(() => {
    if (!selectedLeagueId) {
      setMatchdays([]);
      setSelectedMatchday(null);
      return;
    }
    const load = async () => {
      setLoadingMatchdays(true);
      setMatchdays([]);
      setSelectedMatchday(null);
      try {
        const res = await fetch(`/api/over-05/matchdays?league_id=${selectedLeagueId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setMatchdays(json.matchdays ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setLoadingMatchdays(false);
      }
    };
    load();
  }, [selectedLeagueId]);

  // ─── Lancer l'analyse ─────────────────────────────────────────
  const handleLaunch = async () => {
    if (!selectedLeagueId || !selectedMatchday) return;
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch("/api/over-05/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          league_id: selectedLeagueId,
          matchday_label: selectedMatchday.matchday_label,
          date_from: selectedMatchday.date_from,
          date_to: selectedMatchday.date_to,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      router.push(`/${locale}/espace/over-05-buts-equipes/${json.analysis_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de lancement");
      setLaunching(false);
    }
  };

  const canLaunch =
    selectedLeagueId !== null &&
    selectedMatchday !== null &&
    leaguesWithProjects.has(selectedLeagueId) &&
    !launching;

  // ─── Render ───────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
          🎯 Sélection +0.5 but équipe
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Méthode PROJETS Bertrand · xG + Big Chances + niveau adversaire
        </p>
      </div>

      {/* Card principale sélection */}
      <div
        className="overflow-hidden rounded-xl border border-white/[0.06] p-6"
        style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
      >
        <h2 className="text-base font-black text-white">⚙️ Paramètres d&apos;analyse</h2>

        {/* Championnat */}
        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-white/60">
            Championnat
          </label>
          {loadingLeagues ? (
            <div className="mt-2 h-12 animate-pulse rounded-xl bg-white/5" />
          ) : (
            <select
              value={selectedLeagueId ?? ""}
              onChange={(e) => setSelectedLeagueId(e.target.value ? Number(e.target.value) : null)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
            >
              <option value="" className="bg-neutral-900 text-white">— Sélectionner un championnat —</option>
              {leagues.map((l) => {
                const hasProjects = leaguesWithProjects.has(l.id);
                return (
                  <option key={l.id} value={l.id} disabled={!hasProjects} className="bg-neutral-900 text-white">
                    {l.name} ({l.country}){!hasProjects ? " — 📋 PROJETS à compléter" : ""}
                  </option>
                );
              })}
            </select>
          )}
          {selectedLeagueId !== null && !leaguesWithProjects.has(selectedLeagueId) && (
            <p className="mt-2 text-xs text-yellow-300">
              ⚠️ Ce championnat n&apos;a pas encore de PROJETS configurés en DB. Tous les championnats devraient maintenant être disponibles. Si tu vois ce message, contacte l'admin.
            </p>
          )}
        </div>

        {/* Journée */}
        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-white/60">
            Journée
          </label>
          {loadingMatchdays ? (
            <div className="mt-2 h-12 animate-pulse rounded-xl bg-white/5" />
          ) : (
            <select
              value={selectedMatchday?.round_value ?? ""}
              onChange={(e) => {
                const md = matchdays.find((m) => m.round_value === e.target.value) ?? null;
                setSelectedMatchday(md);
              }}
              disabled={!selectedLeagueId || matchdays.length === 0}
              className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50"
            >
              <option value="" className="bg-neutral-900 text-white">
                {!selectedLeagueId
                  ? "— Sélectionne d'abord un championnat —"
                  : matchdays.length === 0
                  ? "— Aucune journée trouvée —"
                  : "— Sélectionner une journée —"}
              </option>
              {matchdays.map((m) => (
                <option key={m.round_value} value={m.round_value} className="bg-neutral-900 text-white">
                  {m.matchday_label} · {m.match_count} matchs · {formatDateRange(m.date_from, m.date_to)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Résumé sélection */}
        {selectedMatchday && (
          <div className="mt-5 rounded-lg bg-emerald-500/10 p-3 text-sm">
            <p className="font-bold text-emerald-300">
              📊 {selectedMatchday.match_count} matchs détectés sur cette journée
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">
              Période : {formatDateRange(selectedMatchday.date_from, selectedMatchday.date_to)}
            </p>
          </div>
        )}

        {/* Bouton ANALYSER */}
        <button
          onClick={handleLaunch}
          disabled={!canLaunch}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-600"
        >
          {launching ? "⏳ Lancement..." : "🔍 ANALYSER"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            ❌ {error}
          </p>
        )}
      </div>

      {/* Mes dernières analyses */}
      <RecentAnalysesSection
        locale={locale}
        recentAnalyses={recentAnalyses}
        setRecentAnalyses={setRecentAnalyses}
      />

      {/* Lien historique */}
      <div className="mt-8 text-center">
        <Link
          href={`/${locale}/espace/over-05-buts-equipes/historique`}
          className="inline-block rounded-xl border border-neutral-300 px-6 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100"
        >
          📚 Voir tout mon historique
        </Link>
      </div>
    </main>
  );
}


// ─── Composant : Mes dernières analyses ──────────────────────────

function RecentAnalysesSection({
  locale,
  recentAnalyses,
  setRecentAnalyses,
}: {
  locale: string;
  recentAnalyses: RecentAnalysis[];
  setRecentAnalyses: (r: RecentAnalysis[]) => void;
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // On va piocher dans la liste via une requête simple (à défaut d'endpoint dédié,
        // on récupère les leagues pour fallback. Pour l'instant on affiche placeholder)
        // Sera amélioré quand on aura l'endpoint /api/over-05/analyses (list)
        setRecentAnalyses([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setRecentAnalyses]);

  if (loading) return null;
  if (recentAnalyses.length === 0) {
    return (
      <div className="mt-10 text-center text-sm text-neutral-500">
        💡 Tes prochaines analyses apparaîtront ici
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-700">
        📜 Mes dernières analyses
      </h3>
      <div className="grid gap-3">
        {recentAnalyses.map((a) => (
          <Link
            key={a.id}
            href={`/${locale}/espace/over-05-buts-equipes/${a.id}`}
            className="overflow-hidden rounded-xl border border-white/[0.06] p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">
                  {a.league_name}
                  {a.matchday_label && (
                    <span className="ml-2 text-white/40">— {a.matchday_label}</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  {formatDate(a.created_at)} · {a.matches_analyzed}/{a.total_matches} matchs
                </p>
              </div>
              <span className="text-emerald-400">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────

function formatDateRange(from: string, to: string): string {
  const fmt = (d: string) => {
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };
  return from === to ? fmt(from) : `${fmt(from)} → ${fmt(to)}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}