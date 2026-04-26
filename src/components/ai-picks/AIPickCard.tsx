"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * AiPickCard
 * ═══════════════════════════════════════════════════════════════════
 *
 * Composant autonome pour afficher une card de prono IA.
 *
 * Strictement séparé de <PickCard /> (Tipster). Si le module Pronos
 * Tipster est supprimé, ce composant continue à fonctionner.
 * Si le module Pronos IA est supprimé, ce dossier peut être supprimé
 * en entier sans impact sur Tipster.
 *
 * Dépendances neutres (réutilisables pour les deux modules) :
 * - <LiveScore /> dans /components/picks/ (composant de score live générique)
 * - sport-colors.ts dans /lib/picks/ (palette neutre par sport)
 *
 * Le visuel reproduit le rendu Tipster (logo bookmaker en haut,
 * cote au centre, footer cliquable) avec les marqueurs d'identité
 * IA suivants :
 * - Ribbon violet "🤖 IA" en haut à droite
 * - Footer violet "INTELLIGENCE ARTIFICIELLE" cliquable vers le détail
 * - Badge "IA-XXXX" ou "BUT-XXXX" au lieu d'un numéro Tipster
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import LiveScore from "@/components/picks/LiveScore";
import { getColorsForSports } from "@/lib/picks/sport-colors";


// ─── Types ────────────────────────────────────────────────────────

export interface AiPickCardData {
  id: string;
  pick_label: string | null; // "IA-0014" / "BUT-0001"
  sport_slug: string;
  sport_name: string;
  sport_icon: string;
  competition: string;
  event_name: string;
  event_date: string;
  selection: string;
  odds: number | null;
  bookmaker_name: string | null;
  reasoning: string | null;
  status: "pending" | "won" | "lost" | "void";
  detail_href: string | null;
  live_score_data?: unknown;
}


interface AiPickCardProps {
  pick: AiPickCardData;
}


// ─── Module-level caches (partagés entre toutes les cards IA) ─────

type AiBkType = {
  mode: string;
  unit_value: number;
  unit_percent: number;
  current_bankroll: number;
  show_on_site: boolean;
} | null;

let _aiBkCache: AiBkType | undefined = undefined;
let _aiBkPromise: Promise<AiBkType> | null = null;

function getAiBankroll(): Promise<AiBkType> {
  if (_aiBkCache !== undefined) return Promise.resolve(_aiBkCache);
  if (_aiBkPromise) return _aiBkPromise;
  _aiBkPromise = fetch("/api/admin/ai-bankroll")
    .then((r) => r.json())
    .then((d): AiBkType => {
      if (d && d.show_on_site && d.mode !== "units_only") {
        _aiBkCache = d;
      } else {
        _aiBkCache = null;
      }
      return _aiBkCache ?? null;
    })
    .catch((): AiBkType => {
      _aiBkCache = null;
      return null;
    });
  return _aiBkPromise;
}


type BookmakerResolved = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

type BkResolveType = BookmakerResolved[] | null;

let _bkResolveCache: BkResolveType | undefined = undefined;
let _bkResolvePromise: Promise<BkResolveType> | null = null;

function getBookmakersForResolve(): Promise<BkResolveType> {
  if (_bkResolveCache !== undefined) return Promise.resolve(_bkResolveCache);
  if (_bkResolvePromise) return _bkResolvePromise;
  _bkResolvePromise = fetch("/api/bookmakers")
    .then((r) => r.json())
    .then((d): BkResolveType => {
      if (Array.isArray(d)) {
        _bkResolveCache = d;
      } else {
        _bkResolveCache = null;
      }
      return _bkResolveCache ?? null;
    })
    .catch((): BkResolveType => {
      _bkResolveCache = null;
      return null;
    });
  return _bkResolvePromise;
}


// ─── Helpers ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; icon: string }
> = {
  pending: { label: "En cours", bg: "bg-amber-500/15", text: "text-amber-400", icon: "⏳" },
  won: { label: "Gagné", bg: "bg-emerald-500/15", text: "text-emerald-400", icon: "✅" },
  lost: { label: "Perdu", bg: "bg-red-500/15", text: "text-red-400", icon: "❌" },
  void: { label: "Remb.", bg: "bg-neutral-500/15", text: "text-neutral-400", icon: "↩️" },
};


// Petit composant interne pour le compte à rebours
function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  const isUrgent = diff < 3_600_000; // < 1h

  return (
    <span
      className={`flex items-center gap-1 rounded-md px-3 py-2.5 text-[10px] font-bold uppercase tabular-nums tracking-wider ${
        isUrgent ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white/50"
      }`}
    >
      <span>⏱</span>
      {parts.join(" ")}
    </span>
  );
}


// ─── Composant principal ──────────────────────────────────────────

export default function AiPickCard({ pick }: AiPickCardProps) {
  const [aiBk, setAiBk] = useState<AiBkType>(null);
  const [resolvedBookmaker, setResolvedBookmaker] = useState<BookmakerResolved | null>(null);

  // Fetch bankroll IA + résolution logo bookmaker (montage initial)
  useEffect(() => {
    getAiBankroll().then((d) => {
      if (d) setAiBk(d);
    });

    if (pick.bookmaker_name) {
      getBookmakersForResolve().then((list) => {
        if (!list) return;
        const found = list.find(
          (b) => b.name.toLowerCase() === pick.bookmaker_name!.toLowerCase()
        );
        if (found) setResolvedBookmaker(found);
      });
    }
  }, [pick.bookmaker_name]);

  // Couleurs selon le sport (palette partagée Tipster/IA)
  const colors = getColorsForSports([pick.sport_slug]);

  // Calcul de la valeur d'1U en euros depuis la bankroll IA
  const unitEuro = aiBk
    ? aiBk.mode === "fixed_unit"
      ? aiBk.unit_value
      : aiBk.mode === "percent_bankroll"
      ? (aiBk.current_bankroll * aiBk.unit_percent) / 100
      : 0
    : 0;

  const status = STATUS_CONFIG[pick.status] ?? STATUS_CONFIG.pending;
  const isPending = pick.status === "pending";
  const eventDate = new Date(pick.event_date);
  const eventDateLabel = eventDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Live score data peut venir de la DB (pré-chargé)
  const liveScoreData = pick.live_score_data as
    | {
        homeTeam: string;
        awayTeam: string;
        homeScore: number;
        awayScore: number;
        matchStatus: string;
        minute?: string;
        found?: boolean;
        isTennis?: boolean;
        sets?: { home: number; away: number; homeTiebreak?: number; awayTiebreak?: number }[];
      }
    | null
    | undefined;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
      }}
    >
      {/* Ribbon "🤖 IA" violet en haut à droite */}
      <div className="absolute -right-[32px] top-[18px] z-10 rotate-45">
        <div
          className="w-[130px] py-[4px] text-center text-[8px] font-extrabold uppercase tracking-[0.15em] text-white shadow-lg"
          style={{ background: "linear-gradient(90deg, #8b5cf6, #6d28d9)" }}
        >
          🤖 IA
        </div>
      </div>

      <div className="p-4">
        <div className="min-w-0">
          {/* Row 1: badge + sport icon + bookmaker logo + countdown */}
          <div className="flex items-center gap-x-2 gap-y-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {/* Pick label (IA-XXXX / BUT-XXXX) */}
              {pick.pick_label && (
                <span className="rounded-md bg-white/10 px-2.5 py-2.5 font-mono text-[11px] font-bold text-white/50">
                  {pick.pick_label}
                </span>
              )}

              {/* Sport icon */}
              <span className="text-3xl leading-none">{pick.sport_icon}</span>

              {/* Type badge "Simple" */}
              <span className="rounded-md bg-sky-500/20 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Simple
              </span>

              {/* Bookmaker logo (si résolu via la table bookmakers) */}
              {resolvedBookmaker?.logo_url && (
                <Link
                  href={`/fr/bookmakers/${resolvedBookmaker.slug}`}
                  className="overflow-hidden rounded-lg transition hover:scale-105"
                  title={resolvedBookmaker.name}
                >
                  <img
                    src={resolvedBookmaker.logo_url}
                    alt={resolvedBookmaker.name}
                    className="h-[36px] w-[54px] rounded-lg object-cover"
                  />
                </Link>
              )}

              {/* Countdown si en attente */}
              {isPending && <Countdown target={eventDate} />}
            </div>

            {/* Site logo en haut à droite (sous le ribbon) */}
            <img
              src="/pronos_club.png"
              alt="PRONOS.CLUB"
              className="ml-auto mr-6 h-[42px] w-auto flex-shrink-0"
            />
          </div>

          {/* Row 2: Sport + League | Date */}
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-white/40">
            <div className="flex items-center gap-1.5">
              <span style={{ color: colors.accent }}>●</span>
              <span className="font-semibold text-white/70">{pick.sport_name}</span>
              <span>·</span>
              <span className="text-white/50">{pick.competition}</span>
            </div>
            <span className="text-white/40 tabular-nums">{eventDateLabel}</span>
          </div>

          {/* Row 3: Event name + selection */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-base font-extrabold text-white">{pick.event_name}</span>
            <span className="text-white/30">—</span>
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-bold"
              style={{
                background: `${colors.accent}15`,
                color: colors.accent,
              }}
            >
              <span>🎯</span>
              {pick.selection}
            </span>
            {pick.odds !== null && (
              <span
                className="ml-auto rounded-md px-2 py-1 text-sm font-extrabold tabular-nums"
                style={{
                  background: `${colors.accent}25`,
                  color: colors.accent,
                }}
              >
                @{pick.odds.toFixed(3)}
              </span>
            )}
          </div>

          {/* Reasoning si présent */}
          {pick.reasoning && (
            <p className="mt-3 text-xs leading-relaxed text-white/50">
              {pick.reasoning}
            </p>
          )}

          {/* Live Score (utilise le composant générique) */}
          <LiveScore
            pickId={pick.id}
            eventDate={pick.event_date}
            pickStatus={pick.status}
            savedScore={liveScoreData ?? null}
          />

          {/* Bandeau central : cote | mise | bookmaker */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Cote */}
            {pick.odds !== null && (
              <div
                className="rounded-lg px-2.5 py-2.5 text-[13px] font-extrabold tabular-nums"
                style={{
                  background: `${colors.accent}15`,
                  color: colors.accent,
                }}
              >
                {pick.odds.toFixed(3)}
              </div>
            )}

            {/* Mise (1U + équivalent euro si bankroll IA configurée) */}
            <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-2.5">
              <span className="text-[11px] font-bold text-white/60">1U</span>
              {unitEuro > 0 && (
                <span className="text-[10px] text-white/60">({unitEuro.toFixed(0)}€)</span>
              )}
            </div>

            {/* Bookmaker (texte cliquable) */}
            {resolvedBookmaker && (
              <Link
                href={`/fr/bookmakers/${resolvedBookmaker.slug}`}
                className="flex items-center rounded-lg bg-white/5 px-2.5 py-2.5 transition hover:bg-white/10"
                title={resolvedBookmaker.name}
              >
                <span className="text-[11px] font-semibold text-white/60">
                  {resolvedBookmaker.name}
                </span>
              </Link>
            )}

            {/* Status badge */}
            <div
              className={`ml-auto flex items-center gap-1 rounded-lg px-3 py-2 ${status.bg}`}
            >
              <span className={`text-xs ${status.text}`}>{status.icon}</span>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${status.text}`}>
                {status.label}
              </span>
            </div>
          </div>

          {/* Footer "Intelligence Artificielle" cliquable vers le détail dossier */}
          {pick.detail_href ? (
            <Link
              href={pick.detail_href}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-violet-500/10 py-2.5 text-[11px] font-bold text-violet-300 transition hover:bg-violet-500/20 hover:text-violet-200"
            >
              <span>🤖</span>
              <span className="uppercase tracking-[0.1em]">Intelligence Artificielle</span>
            </Link>
          ) : (
            <div className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500/10 py-2.5 text-[11px] font-bold text-violet-300">
              <span>🤖</span>
              <span className="uppercase tracking-[0.1em]">Intelligence Artificielle</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}