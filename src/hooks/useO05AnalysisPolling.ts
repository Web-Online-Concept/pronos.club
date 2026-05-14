// src/hooks/useO05AnalysisPolling.ts
//
// Hook custom React qui poll /api/over-05/analyses/[id] toutes les 3 secondes
// tant que l'analyse est en status "pending" ou "running".
// Stoppe automatiquement quand status = "completed" ou "failed".

"use client";

import { useEffect, useRef, useState } from "react";

type MatchAnalysisRow = {
  id: string;
  api_football_fixture_id: number | null;
  match_date: string;
  home_team_id: number;
  away_team_id: number;
  target_team_id: number;
  target_role: "home" | "away";
  attack_score: number | null;
  defense_score: number | null;
  total_score: number | null;
  note_10: number | null;
  verdict: "TRÈS BON" | "BON" | "MOYEN" | "FAIBLE" | null;
  data_quality: "complete" | "partial" | "missing" | null;
  error_message: string | null;
  home_team: { id: number; name: string } | null;
  away_team: { id: number; name: string } | null;
  target_team: { id: number; name: string } | null;
};

export type AnalysisData = {
  analysis: {
    id: string;
    league_id: number;
    matchday_label: string | null;
    date_from: string;
    date_to: string;
    total_matches: number;
    matches_analyzed: number;
    matches_failed: number;
    status: "pending" | "running" | "completed" | "failed";
    error_message: string | null;
    requested_by: string;
    created_at: string;
    completed_at: string | null;
  };
  match_analyses: MatchAnalysisRow[];
};

const POLL_INTERVAL_MS = 3000;

export function useO05AnalysisPolling(analysisId: string | null) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  const isPolling = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!analysisId) {
      setData(null);
      setLoading(false);
      return;
    }

    isPolling.current = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/over-05/analyses/${analysisId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as AnalysisData;

        if (!isMounted.current) return;
        setData(json);
        setLoading(false);
        setError(null);

        // Continuer le polling si en cours
        const status = json.analysis.status;
        if (status === "pending" || status === "running") {
          if (isPolling.current && isMounted.current) {
            timeoutId = setTimeout(fetchOnce, POLL_INTERVAL_MS);
          }
        } else {
          isPolling.current = false;
        }
      } catch (err) {
        if (!isMounted.current) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
        // En cas d'erreur, on retente une fois après un délai plus long
        if (isPolling.current && isMounted.current) {
          timeoutId = setTimeout(fetchOnce, POLL_INTERVAL_MS * 2);
        }
      }
    };

    fetchOnce();

    return () => {
      isPolling.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [analysisId]);

  return { data, error, loading };
}