// src/components/ai-picks/AIScorerCard.tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export interface AIScorerRow {
  id: string;
  pick_type: "scorer";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number | null;
  odds_bookmaker?: string | null;
  odds_comparison: Array<{ book: string; odds: number }> | null;
  reasoning: string;
  ai_confidence: number;
  status: "pending" | "won" | "lost" | "void";
  final_score: string | null;
  slug?: string | null;
  consensus_tier?: "total_agreement" | "partial" | "isolated_high" | "isolated_low" | null;
  consensus_score?: number | null;
}

const DATE_LOCALES: Record<string, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES" };

export default function AIScorerCard({
  pick,
  locale,
  showResult = false,
  isAwaiting = false,
}: {
  pick: AIScorerRow;
  locale: string;
  showResult?: boolean;
  isAwaiting?: boolean;
}) {
  const t = useTranslations("ai_picks");

  const computeUnitsResult = (): number | null => {
    if (pick.status === "won" && pick.odds !== null) return Number((pick.odds - 1).toFixed(2));
    if (pick.status === "lost") return -1;
    if (pick.status === "void") return 0;
    return null;
  };
  const unitsResult = computeUnitsResult();

  const displayStatus = isAwaiting ? "awaiting" : pick.status;

  const theme = displayStatus === "won"
    ? { accent: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", ring: "rgba(16,185,129,0.4)", text: "#34d399", label: t("status_won") }
    : displayStatus === "lost"
    ? { accent: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", ring: "rgba(239,68,68,0.4)", text: "#fca5a5", label: t("status_lost") }
    : displayStatus === "void"
    ? { accent: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", ring: "rgba(148,163,184,0.4)", text: "#cbd5e1", label: t("status_void") }
    : displayStatus === "awaiting"
    ? { accent: "#06b6d4", bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.2)", ring: "rgba(6,182,212,0.4)", text: "#67e8f9", label: t("status_awaiting") }
    : { accent: "#e879f9", bg: "rgba(232,121,249,0.08)", border: "rgba(232,121,249,0.2)", ring: "rgba(232,121,249,0.4)", text: "rgba(232,121,249,0.9)", label: t("status_pending") };

  const dateLocale = DATE_LOCALES[locale] || "fr-FR";
  const matchDate = new Date(pick.event_date);
  const matchDateStr = matchDate.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
  }).toUpperCase();
  const matchTimeStr = matchDate.toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const detailsHref = pick.slug ? `/${locale}/pronos-ia/match/${pick.slug}` : null;

  return (
    <div>
      <div
        style={{
          position: "relative",
          background: "linear-gradient(180deg, #1a0d24 0%, #100818 100%)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: `0 4px 24px rgba(0,0,0,0.3), inset 0 0 0 1px ${theme.ring}`,
        }}
      >
        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "3px",
            background: `linear-gradient(90deg, transparent 0%, ${theme.accent} 30%, ${theme.accent} 70%, transparent 100%)`,
          }}
        />

        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "80px" }}>
            <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.2em" }}>{t("label_competition")}</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", lineHeight: 1.1, textAlign: "center" }}>
              {pick.league}
            </span>
          </div>

          <img
            src="/pronos_club.png"
            alt="PRONOS.CLUB"
            style={{ width: "48px", height: "48px", objectFit: "contain" }}
          />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "80px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.05em" }}>
              {matchDateStr}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#ffffff" }}>
              {matchTimeStr}
            </span>
          </div>
        </div>

        <div style={{ padding: "12px 16px", textAlign: "center", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", marginBottom: "6px" }}>
            {pick.event_name}
          </div>
          <div style={{ fontSize: "15px", fontWeight: 800, color: theme.text }}>
            ⚽ {pick.selection}
          </div>
          {pick.reasoning && (
            <p style={{ fontSize: "11px", fontStyle: "italic", color: "rgba(255,255,255,0.5)", marginTop: "8px", lineHeight: 1.4, marginBottom: 0 }}>
              {pick.reasoning}
            </p>
          )}
        </div>

        <div style={{ padding: "12px 16px 14px", display: "grid", gridTemplateColumns: showResult && unitsResult !== null ? "1fr 1fr 1fr" : "1fr 1fr", gap: "6px" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>{t("label_type")}</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#e879f9", margin: "2px 0 0" }}>
              {t("type_scorer_short")}
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>{t("label_odds")}</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {pick.odds !== null ? pick.odds.toFixed(2) : "-"}
            </p>
          </div>
          {showResult && unitsResult !== null && (
            <div style={{
              background: theme.bg,
              borderRadius: "8px",
              padding: "8px",
              textAlign: "center",
              border: `1px solid ${theme.border}`,
            }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>{t("label_result")}</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: theme.text, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                {unitsResult >= 0 ? "+" : ""}{unitsResult.toFixed(2)}U
              </p>
            </div>
          )}
        </div>

        <div style={{
          padding: "10px 16px",
          background: theme.bg,
          borderTop: `1px solid ${theme.border}`,
          textAlign: "center",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: theme.text }}>
            {displayStatus === "won" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
            )}
            {displayStatus === "lost" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            {displayStatus === "void" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /></svg>
            )}
            {(displayStatus === "pending" || displayStatus === "awaiting") && (
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: theme.accent, display: "inline-block" }} />
            )}
            {theme.label}
          </span>
        </div>

        <div style={{
          padding: "8px 14px",
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(232,121,249,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>
            🤖
          </div>
          {detailsHref ? (
            <Link
              href={detailsHref}
              style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}
            >
              {t("footer_ai")}
            </Link>
          ) : (
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {t("footer_ai")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}