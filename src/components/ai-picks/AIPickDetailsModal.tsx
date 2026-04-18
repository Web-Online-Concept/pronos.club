/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIPickDetailsModal
 * ═══════════════════════════════════════════════════════════════════
 *
 * Modale de détails enrichis pour un pick IA.
 * Affiche : header, pick+confidence, 5 cotes bookmakers, justification,
 *           statut audit, score final (si résolu).
 *
 * Desktop : modale centrée 700px.
 * Mobile  : bottom sheet plein écran.
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Medal, Shield, Search, Trophy } from "lucide-react";
import PronosIAStatusBadge from "./ui/PronosIAStatusBadge";


interface OddsComparisonItem {
  book: string;
  odds: number;
}


interface PickDetails {
  id: string;
  pick_type: "classic" | "scorer";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number | null;
  odds_bookmaker: string | null;
  odds_comparison: OddsComparisonItem[] | null;
  reasoning: string;
  ai_confidence: number;
  status: "pending" | "won" | "lost" | "void";
  final_score: string | null;
}


const BOOKMAKER_LABELS: Record<string, string> = {
  pinnacle: "Pinnacle",
  onexbet: "1xBet",
  winamax_fr: "Winamax",
  betclic_fr: "Betclic",
  unibet_fr: "Unibet",
};


const LEAGUE_LABELS: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_france_ligue_one: "Ligue 1",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_italy_serie_a: "Serie A",
  soccer_spain_la_liga: "La Liga",
  soccer_uefa_champs_league: "Champions League",
  tennis_atp: "ATP",
  tennis_wta: "WTA",
  basketball_nba: "NBA",
};


const SPORT_EMOJI: Record<string, string> = {
  soccer: "⚽",
  tennis: "🎾",
  basketball: "🏀",
};


interface Props {
  pick: PickDetails;
  locale: string;
  onClose: () => void;
}


export default function AIPickDetailsModal({ pick, locale, onClose }: Props) {
  const t = useTranslations("ai_picks");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Lock scroll body
    document.body.style.overflow = "hidden";

    // Close on Escape
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  const sportEmoji = SPORT_EMOJI[pick.sport] ?? "🏅";
  const leagueLabel = LEAGUE_LABELS[pick.league] ?? pick.league;
  const statusLabel = t(`status_${pick.status}`);

  const eventDate = new Date(pick.event_date);
  const formattedDate = eventDate.toLocaleDateString(
    { fr: "fr-FR", en: "en-US", es: "es-ES" }[locale] ?? "fr-FR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Paris",
    },
  );
  const formattedTime = eventDate.toLocaleTimeString(
    { fr: "fr-FR", en: "en-US", es: "es-ES" }[locale] ?? "fr-FR",
    { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" },
  );

  // Tri des cotes (meilleure en premier)
  const sortedOdds = pick.odds_comparison
    ? [...pick.odds_comparison].sort((a, b) => b.odds - a.odds)
    : [];

  // Confiance IA (sur 10)
  const confidence = Math.max(0, Math.min(10, pick.ai_confidence));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full overflow-hidden overflow-y-auto rounded-t-3xl border border-violet-400/30 shadow-2xl sm:max-w-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
        }}
      >
        {/* Halos lumineux */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.35) 0%, transparent 50%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 0% 100%, rgba(59, 130, 246, 0.25) 0%, transparent 50%)",
          }}
        />
        {/* Barre lumineuse en haut */}
        <div
          aria-hidden
          className="absolute left-0 top-0 h-[2px] w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #a855f7 30%, #3b82f6 70%, transparent 100%)",
          }}
        />

        {/* Bouton fermer */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 backdrop-blur transition hover:bg-white/15 hover:text-white"
          aria-label="Fermer"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {/* Contenu */}
        <div className="relative z-10 p-6 sm:p-8">

          {/* ═══ HEADER ═══ */}
          <div className="mb-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                <span className="text-sm">{sportEmoji}</span>
                <span>{leagueLabel}</span>
              </span>
              <PronosIAStatusBadge
                status={pick.status}
                label={statusLabel}
                size="sm"
              />
            </div>
            <h2 className="mb-1 text-2xl font-extrabold leading-tight text-white">
              {pick.event_name}
            </h2>
            <p className="text-sm capitalize text-white/60">
              {formattedDate} · <span className="font-mono">{formattedTime}</span>
            </p>
          </div>

          {/* ═══ RECOMMANDATION + CONFIANCE ═══ */}
          <Section icon="🎯" title={t("modal_recommendation_title")}>
            <div className="rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 p-5 backdrop-blur">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                {pick.pick_type === "scorer" ? t("scorer_label") : t("pick_label")}
              </div>
              <div
                className="mb-4 text-3xl font-black leading-tight tracking-tight"
                style={{
                  background:
                    "linear-gradient(135deg, #ffffff 0%, #e9d5ff 50%, #c4b5fd 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {pick.selection}
              </div>

              {/* Confiance IA */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-white/70">
                    {t("modal_ai_confidence")}
                  </span>
                  <span className="font-mono font-bold text-violet-200">
                    {confidence}/10
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-2 flex-1 rounded-full transition-all"
                      style={{
                        background:
                          i < confidence
                            ? "linear-gradient(90deg, #3b82f6 0%, #a855f7 100%)"
                            : "rgba(255, 255, 255, 0.1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ═══ 5 COTES BOOKMAKERS ═══ */}
          {sortedOdds.length > 0 && (
            <Section icon="💰" title={t("modal_odds_comparison_title")}>
              <div className="space-y-1.5">
                {sortedOdds.map((item, idx) => {
                  const isBest = idx === 0;
                  const bookmakerLabel =
                    BOOKMAKER_LABELS[item.book] ?? item.book;
                  return (
                    <div
                      key={item.book}
                      className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${
                        isBest
                          ? "border border-violet-400/40 bg-gradient-to-r from-violet-500/15 to-violet-500/5"
                          : "border border-white/5 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isBest ? (
                          <Medal
                            size={16}
                            strokeWidth={2.5}
                            className="text-violet-300"
                          />
                        ) : (
                          <span className="w-4 text-center text-xs text-white/30">
                            {idx + 1}
                          </span>
                        )}
                        <span
                          className={
                            isBest
                              ? "font-semibold text-white"
                              : "text-white/80"
                          }
                        >
                          {bookmakerLabel}
                        </span>
                        {isBest && (
                          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                            {t("modal_best_odds")}
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          isBest ? "text-lg text-white" : "text-white/70"
                        }`}
                      >
                        {item.odds.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ═══ JUSTIFICATION ═══ */}
          <Section icon="💬" title={t("modal_reasoning_title")}>
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm italic leading-relaxed text-white/80">
              {pick.reasoning}
            </p>
          </Section>

          {/* ═══ AUDIT ═══ */}
          <Section icon={null} title={t("modal_audit_title")}>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4">
              <Shield
                size={20}
                strokeWidth={2.5}
                className="mt-0.5 flex-shrink-0 text-emerald-300"
              />
              <div className="text-sm text-white/80">
                <div className="mb-1 font-semibold text-emerald-200">
                  {t("modal_audit_passed")}
                </div>
                <p className="text-xs text-white/60">
                  {t("modal_audit_description")}
                </p>
              </div>
            </div>
          </Section>

          {/* ═══ SCORE FINAL (si résolu) ═══ */}
          {pick.status !== "pending" && pick.final_score && (
            <Section icon={null} title={t("modal_final_result_title")}>
              <div className="flex items-center justify-center gap-4 rounded-xl border border-white/10 bg-black/30 py-5 backdrop-blur">
                <Trophy
                  size={20}
                  strokeWidth={2.5}
                  className="text-white/60"
                />
                <span className="font-mono text-2xl font-black text-white">
                  {pick.final_score}
                </span>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANT : section titrée
// ═══════════════════════════════════════════════════════════════════

function Section({
  icon,
  title,
  children,
}: {
  icon: string | null;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
        {icon && <span className="text-base">{icon}</span>}
        <span>{title}</span>
      </h3>
      {children}
    </div>
  );
}