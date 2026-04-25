import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import PronosIACard from "./ui/PronosIACard";
import PronosIAStatusBadge from "./ui/PronosIAStatusBadge";


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
  consensus_tier?:
    | "total_agreement"
    | "partial"
    | "isolated_high"
    | "isolated_low"
    | null;
  consensus_score?: number | null;
}


const LEAGUE_LABELS: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_france_ligue_one: "Ligue 1",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_italy_serie_a: "Serie A",
  soccer_spain_la_liga: "La Liga",
  soccer_uefa_champs_league: "Champions League",
};


const DATE_LOCALES: Record<string, string> = {
  fr: "fr-FR",
  en: "en-GB",
  es: "es-ES",
};


const computeUnitsResult = (
  status: string,
  odds: number | null
): number | null => {
  if (status === "won" && odds !== null) return Number((odds - 1).toFixed(2));
  if (status === "lost") return -1;
  if (status === "void") return 0;
  return null;
};


const buildConsensusBadge = (
  tier: AIScorerRow["consensus_tier"],
  t: (key: string) => string
): { emoji: string; label: string; bg: string; text: string } | null => {
  if (!tier) return null;
  if (tier === "total_agreement") {
    return {
      emoji: "🟢",
      label: t("consensus_total"),
      bg: "bg-emerald-500/15 border-emerald-400/30",
      text: "text-emerald-300",
    };
  }
  if (tier === "partial") {
    return {
      emoji: "🟡",
      label: t("consensus_partial"),
      bg: "bg-amber-500/15 border-amber-400/30",
      text: "text-amber-300",
    };
  }
  return {
    emoji: "🟠",
    label: t("consensus_solo"),
    bg: "bg-orange-500/15 border-orange-400/30",
    text: "text-orange-300",
  };
};


interface Props {
  pick: AIScorerRow;
  locale: string;
  isAwaiting?: boolean;
  showResult?: boolean;
}


export default async function AIScorerCard({
  pick,
  locale,
  isAwaiting = false,
  showResult = false,
}: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const displayStatus = isAwaiting ? "awaiting" : pick.status;
  const accent =
    displayStatus === "won"
      ? "emerald"
      : displayStatus === "lost"
        ? "red"
        : displayStatus === "void"
          ? "neutral"
          : "fuchsia";

  const leagueLabel = LEAGUE_LABELS[pick.league] ?? pick.league;
  const dateLocale = DATE_LOCALES[locale] ?? "fr-FR";
  const eventDate = new Date(pick.event_date);
  const matchDateStr = eventDate
    .toLocaleDateString(dateLocale, {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Paris",
    })
    .toUpperCase();
  const matchTimeStr = eventDate.toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  const statusLabel = t(`status_${displayStatus}`);
  const unitsResult = computeUnitsResult(pick.status, pick.odds);
  const consensusBadge = buildConsensusBadge(pick.consensus_tier ?? null, t);
  const detailsHref = pick.slug
    ? `/${locale}/pronos-ia/match/${pick.slug}`
    : null;

  return (
    <PronosIACard accent={accent} hoverable>
      <div className="flex items-center justify-between gap-2 border-b border-dashed border-white/10 px-4 py-3">
        <div className="flex min-w-[70px] flex-col items-center gap-0.5">
          <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/40">
            {t("label_competition")}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold leading-tight text-white">
            <span className="text-sm">⚽</span>
            <span className="truncate">{leagueLabel}</span>
          </span>
        </div>

        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-fuchsia-500/20 text-base">
          🤖
        </div>

        <div className="flex min-w-[70px] flex-col items-center gap-0.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.05em] text-white">
            {matchDateStr}
          </span>
          <span className="text-[11px] font-extrabold tabular-nums text-white">
            {matchTimeStr}
          </span>
        </div>
      </div>

      <div className="px-4 pt-3">
        <h3 className="text-center text-[13px] font-bold leading-tight text-white">
          {pick.event_name}
        </h3>
      </div>

      <div className="px-4 pt-3">
        <div
          className="rounded-lg border border-fuchsia-400/25 bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 p-2.5"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[10px]">⚽</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-fuchsia-200">
              {t("scorer_label")}
            </span>
          </div>
          <div className="text-base font-extrabold tracking-tight text-white">
            {pick.selection}
          </div>
        </div>
      </div>

      <div
        className="grid gap-1.5 px-4 pt-2.5"
        style={{
          gridTemplateColumns:
            showResult && unitsResult !== null ? "1fr 1fr 1fr" : "1fr 1fr",
        }}
      >
        <div className="rounded-md bg-white/[0.04] p-1.5 text-center">
          <p className="m-0 text-[8px] font-bold uppercase tracking-[0.12em] text-white/40">
            {t("label_type")}
          </p>
          <p className="m-0 mt-0.5 text-[11px] font-bold text-fuchsia-200">
            {t("type_scorer_short")}
          </p>
        </div>
        <div className="rounded-md bg-white/[0.04] p-1.5 text-center">
          <p className="m-0 text-[8px] font-bold uppercase tracking-[0.12em] text-white/40">
            {t("label_odds")}
          </p>
          <p className="m-0 mt-0.5 text-[11px] font-bold tabular-nums text-white">
            {pick.odds !== null ? pick.odds.toFixed(2) : "-"}
          </p>
        </div>
        {showResult && unitsResult !== null && (
          <div
            className={`rounded-md p-1.5 text-center ${
              pick.status === "won"
                ? "border border-emerald-400/30 bg-emerald-500/10"
                : pick.status === "lost"
                  ? "border border-red-400/30 bg-red-500/10"
                  : "border border-white/10 bg-white/[0.04]"
            }`}
          >
            <p className="m-0 text-[8px] font-bold uppercase tracking-[0.12em] text-white/40">
              {t("label_result")}
            </p>
            <p
              className={`m-0 mt-0.5 text-[11px] font-bold tabular-nums ${
                pick.status === "won"
                  ? "text-emerald-300"
                  : pick.status === "lost"
                    ? "text-red-300"
                    : "text-white"
              }`}
            >
              {unitsResult >= 0 ? "+" : ""}
              {unitsResult.toFixed(2)}U
            </p>
          </div>
        )}
      </div>

      {pick.reasoning && (
        <div className="px-4 pt-2.5">
          <p className="line-clamp-2 text-[11px] leading-snug italic text-white/60">
            <span className="mr-1 not-italic text-fuchsia-300">💬</span>
            {pick.reasoning}
          </p>
        </div>
      )}

      {pick.final_score && pick.status !== "pending" && (
        <div className="mx-4 mt-2.5 flex items-center justify-center gap-2 rounded-md border border-white/10 bg-black/20 py-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">
            {t("final_score_label")}
          </span>
          <span className="text-xs font-bold tabular-nums text-white">
            {pick.final_score}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 bg-black/20 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <PronosIAStatusBadge
            status={displayStatus}
            label={statusLabel}
            size="sm"
          />
          {consensusBadge && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${consensusBadge.bg} ${consensusBadge.text}`}
            >
              <span>{consensusBadge.emoji}</span>
              <span>{consensusBadge.label}</span>
            </span>
          )}
        </div>
        {detailsHref && (
          <Link
            href={detailsHref}
            className="group/btn inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10 hover:text-white"
          >
            <span>{t("details_link")}</span>
            <ChevronRight
              size={11}
              strokeWidth={2.5}
              className="transition-transform group-hover/btn:translate-x-0.5"
            />
          </Link>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 border-t border-white/[0.04] bg-black/30 px-4 py-2">
        <span className="text-[10px]">🤖</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/80">
          {t("footer_ai")}
        </span>
      </div>
    </PronosIACard>
  );
}