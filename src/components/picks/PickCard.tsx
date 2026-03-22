"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Pick, Bookmaker } from "@/lib/supabase/types";

// Module-level cache for tipster bankroll — shared across all PickCard instances
let _tipsterBkCache: { mode: string; unit_value: number; unit_percent: number; current_bankroll: number; show_on_site: boolean } | null | undefined = undefined;
let _tipsterBkPromise: Promise<typeof _tipsterBkCache> | null = null;

function getTipsterBankroll() {
  if (_tipsterBkCache !== undefined) return Promise.resolve(_tipsterBkCache);
  if (_tipsterBkPromise) return _tipsterBkPromise;
  _tipsterBkPromise = fetch("/api/admin/tipster-bankroll")
    .then((r) => r.json())
    .then((d) => {
      if (d && d.show_on_site && d.mode !== "units_only") {
        _tipsterBkCache = d;
      } else {
        _tipsterBkCache = null;
      }
      return _tipsterBkCache;
    })
    .catch(() => {
      _tipsterBkCache = null;
      return null;
    });
  return _tipsterBkPromise;
}

function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  const isUrgent = diff < 3_600_000; // < 1h

  return (
    <span
      className={`flex items-center gap-1 rounded-md px-3 py-2.5 text-[10px] font-bold uppercase tabular-nums tracking-wider ${
        isUrgent
          ? "bg-red-500/20 text-red-400"
          : "bg-white/5 text-white/50"
      }`}
    >
      <span>⏱</span>
      {parts.join(" ")}
    </span>
  );
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "En cours", color: "text-amber-400", icon: "⏳" },
  won: { label: "Gagné", color: "text-emerald-400", icon: "✅" },
  lost: { label: "Perdu", color: "text-red-400", icon: "❌" },
  void: { label: "Remb.", color: "text-neutral-400", icon: "↩️" },
  half_won: { label: "½ Gagné", color: "text-emerald-400", icon: "✅" },
  half_lost: { label: "½ Perdu", color: "text-red-400", icon: "❌" },
};

const SPORT_COLORS: Record<string, { from: string; to: string; accent: string }> = {
  football: { from: "#0a0a0a", to: "#0a3d23", accent: "#10b981" },
  tennis: { from: "#081828", to: "#124a78", accent: "#38bdf8" },
  basketball: { from: "#0a0a0a", to: "#3d2008", accent: "#f97316" },
  hockey: { from: "#0a0a0a", to: "#08163d", accent: "#3b82f6" },
  rugby: { from: "#0a0a0a", to: "#0a0c3d", accent: "#6366f1" },
  baseball: { from: "#0a0a0a", to: "#3d0a0a", accent: "#ef4444" },
  mma: { from: "#0a0a0a", to: "#3d0a18", accent: "#e11d48" },
  esport: { from: "#0a0a0a", to: "#240a3d", accent: "#a78bfa" },
};

const DEFAULT_COLORS = { from: "#0a0a0a", to: "#1a1a1a", accent: "#9ca3af" };
const COMBI_MIXED_COLORS = { from: "#0a0a0a", to: "#2a0a3d", accent: "#c084fc" };

function getPickColors(pick: Pick, legs: PickLeg[]) {
  const isCombi = pick.pick_type === "combine" && legs.length > 1;

  if (!isCombi) {
    const sportSlug = pick.sport?.slug ?? "";
    return SPORT_COLORS[sportSlug] ?? DEFAULT_COLORS;
  }

  // Combined: check if all legs are same sport
  const sportSlugs = new Set(legs.map((l) => l.sport?.slug ?? pick.sport?.slug ?? ""));

  if (sportSlugs.size === 1) {
    // Same sport — use that sport's color
    const slug = [...sportSlugs][0];
    return SPORT_COLORS[slug] ?? DEFAULT_COLORS;
  }

  // Mixed sports — special purple
  return COMBI_MIXED_COLORS;
}

function getStatusBg(status: string): string {
  switch (status) {
    case "won":
    case "half_won":
      return "bg-emerald-500/10 border border-emerald-500/20";
    case "lost":
    case "half_lost":
      return "bg-red-500/10 border border-red-500/20";
    case "void":
      return "bg-neutral-500/10 border border-neutral-500/20";
    default:
      return "bg-white/5";
  }
}

interface PickCardProps {
  pick: Pick;
  locked?: boolean;
  /** When in user's personal history, show their profit instead of tipster's */
  userProfit?: number | null;
}

export default function PickCard({ pick, locked = false, userProfit }: PickCardProps) {
  const { user } = useAuth();
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [userOdds, setUserOdds] = useState("");
  const [userBookmakerId, setUserBookmakerId] = useState("");
  const [userBookOther, setUserBookOther] = useState("");
  const [userBookName, setUserBookName] = useState("");
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [userLegOdds, setUserLegOdds] = useState<Record<number, string>>({});
  const [bkConfig, setBkConfig] = useState<{ mode: string; current_bankroll: number; unit_value: number; unit_percent: number } | null>(null);
  const [tipsterBk, setTipsterBk] = useState<{ mode: string; unit_value: number; unit_percent: number; current_bankroll: number; show_on_site: boolean } | null>(null);
  const status = STATUS_CONFIG[pick.status] ?? STATUS_CONFIG.pending;
  const isPending = pick.status === "pending";
  const isPremiumUser = user?.subscription_status === "active";
  const isCombi = pick.pick_type === "combine" && (pick.legs?.length ?? 0) > 1;
  const legs = (pick.legs ?? []).sort((a, b) => a.leg_number - b.leg_number);
  const colors = getPickColors(pick, legs);

  // Fetch follow status on mount
  useEffect(() => {
    if (!user || locked) return;
    fetch(`/api/user-picks?pick_id=${pick.id}`)
      .then((r) => r.json())
      .then((d) => {
        setFollowed(d.followed ?? false);
        if (d.user_odds) setUserOdds(String(d.user_odds));
        if (d.user_bookmaker_id) setUserBookmakerId(d.user_bookmaker_id);
        if (d.user_bookmaker_other) {
          setUserBookOther(d.user_bookmaker_other);
          setUserBookName(d.user_bookmaker_other);
        }
        // Resolve bookmaker name if followed with a bookmaker_id
        if (d.followed && d.user_bookmaker_id && !d.user_bookmaker_other) {
          fetch("/api/bookmakers").then((r) => r.json()).then((books: Bookmaker[]) => {
            setBookmakers(books);
            const b = books.find((bk: Bookmaker) => bk.id === d.user_bookmaker_id);
            if (b) setUserBookName(b.name);
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [user, pick.id, locked]);

  // Fetch tipster bankroll config (cached at module level — one fetch for all cards)
  useEffect(() => {
    getTipsterBankroll().then((d) => {
      if (d) setTipsterBk(d);
    });
  }, []);

  function openFollowModal() {
    if (!user || followLoading) return;
    if (followed) {
      // Already followed — clicking removes
      toggleFollow(false);
      return;
    }
    // Pre-fill with pick values
    if (isCombi) {
      // For combined: pre-fill each leg's odds
      const legOdds: Record<number, string> = {};
      legs.forEach((l) => { legOdds[l.leg_number] = String(l.odds); });
      setUserLegOdds(legOdds);
      // Combined odds = product of legs
      const combined = legs.reduce((acc, l) => acc * l.odds, 1);
      setUserOdds(String(Math.round(combined * 100) / 100));
    } else {
      setUserOdds(String(pick.odds));
      setUserLegOdds({});
    }
    setUserBookmakerId(pick.bookmaker?.id ?? "");
    setUserBookOther("");
    // Fetch bookmakers if not loaded
    if (bookmakers.length === 0) {
      fetch("/api/bookmakers").then((r) => r.json()).then(setBookmakers).catch(() => {});
    }
    // Fetch bankroll config
    if (!bkConfig) {
      fetch("/api/user-bankroll").then((r) => r.json()).then(setBkConfig).catch(() => {});
    }
    setShowFollowModal(true);
  }

  function updateLegOdds(legNumber: number, value: string) {
    const updated = { ...userLegOdds, [legNumber]: value };
    setUserLegOdds(updated);
    // Recalculate combined odds
    const product = Object.values(updated).reduce((acc, v) => acc * (parseFloat(v) || 1), 1);
    setUserOdds(String(Math.round(product * 100) / 100));
  }

  async function confirmFollow() {
    setFollowLoading(true);
    setShowFollowModal(false);
    setFollowed(true);

    // Resolve book name for display
    if (userBookmakerId === "other") {
      setUserBookName(userBookOther);
    } else {
      const b = bookmakers.find((bk) => bk.id === userBookmakerId);
      if (b) setUserBookName(b.name);
    }

    // Build user_leg_odds array for combined picks
    const legOddsPayload = isCombi
      ? Object.entries(userLegOdds).map(([legNum, odds]) => ({
          leg_number: parseInt(legNum),
          odds: parseFloat(odds) || 0,
        }))
      : null;

    try {
      const res = await fetch("/api/user-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pick_id: pick.id,
          followed: true,
          user_odds: userOdds ? parseFloat(userOdds) : null,
          user_bookmaker_id: userBookmakerId === "other" ? null : (userBookmakerId || null),
          user_bookmaker_other: userBookmakerId === "other" ? userBookOther : null,
          user_leg_odds: legOddsPayload,
        }),
      });
      if (!res.ok) setFollowed(false);
    } catch {
      setFollowed(false);
    }
    setFollowLoading(false);
  }

  async function toggleFollow(newState: boolean) {
    if (!user || followLoading) return;
    setFollowLoading(true);
    setFollowed(newState);

    try {
      const res = await fetch("/api/user-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick_id: pick.id, followed: newState }),
      });
      if (!res.ok) setFollowed(!newState);
    } catch {
      setFollowed(!newState);
    }
    setFollowLoading(false);
  }
  const eventDate = new Date(pick.event_date);
  const isAwaitingResult = isPending && eventDate <= new Date();

  // Tipster unit value in euros (for display on ticket)
  const tipsterUnitEuro = tipsterBk
    ? tipsterBk.mode === "fixed_unit"
      ? tipsterBk.unit_value
      : tipsterBk.mode === "percent_bankroll"
      ? (tipsterBk.current_bankroll * tipsterBk.unit_percent) / 100
      : 0
    : 0;

  return (
    <>
      <div
        className="group relative overflow-hidden rounded-2xl border border-white/[0.06] shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
        style={{
          background: `linear-gradient(135deg, ${colors.from} 0%, ${colors.to} 100%)`,
        }}
      >
        {/* Accent line top */}
        <div
          className="h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${colors.accent} 50%, transparent 100%)` }}
        />

        {/* Premium/Gratuit ribbon — top right corner */}
        <div className="absolute -right-[32px] top-[18px] z-10 rotate-45">
          {pick.is_premium ? (
            <div className="w-[130px] py-[4px] text-center text-[8px] font-extrabold uppercase tracking-[0.15em] text-white shadow-lg"
              style={{ background: "linear-gradient(90deg, #f59e0b, #d97706)" }}>
              Premium
            </div>
          ) : (
            <div className="w-[130px] bg-sky-500 py-[4px] text-center text-[8px] font-extrabold uppercase tracking-[0.15em] text-white shadow-lg">
              Gratuit
            </div>
          )}
        </div>

        {/* Site logo — below ribbon */}

        <div className="p-4">
          {/* Content */}
          <div className="min-w-0">
            {/* Row 1: sport icon + number + badges + bookmaker logo */}
            <div className="flex items-center gap-x-2 gap-y-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {/* Pick number */}
              {!locked && pick.pick_number && (
                <span className="rounded-md bg-white/10 px-2.5 py-2.5 font-mono text-[11px] font-bold text-white/50">
                  {String(pick.pick_number).padStart(4, "0")}
                </span>
              )}
              {/* Sport icon — matched to badge height */}
              {isCombi ? (
                <span className="-mr-0.5 flex items-center gap-0">
                  {legs.map((leg) => (
                    <span key={leg.leg_number} className="text-3xl leading-none">{leg.sport?.icon ?? pick.sport?.icon}</span>
                  ))}
                </span>
              ) : (
                <span className="text-3xl leading-none">{pick.sport?.icon}</span>
              )}
              {isCombi ? (
                <span className="rounded-md bg-purple-500/20 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Combiné
                </span>
              ) : (
                <span className="rounded-md bg-sky-500/20 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Simple
                </span>
              )}
              {/* Bookmaker logo */}
              {!locked && pick.bookmaker?.logo_url && (
                pick.screenshot_url ? (
                  <button
                    onClick={() => setShowScreenshot(true)}
                    className="group/logo cursor-pointer overflow-hidden rounded-lg transition hover:scale-105"
                    title="Voir le ticket"
                  >
                    <img
                      src={pick.bookmaker.logo_url}
                      alt={pick.bookmaker.name}
                      className="h-[36px] w-[54px] rounded-lg object-cover"
                    />
                  </button>
                ) : (
                  <div className="overflow-hidden rounded-lg">
                    <img
                      src={pick.bookmaker.logo_url}
                      alt={pick.bookmaker.name}
                      className="h-[36px] w-[54px] rounded-lg object-cover"
                    />
                  </div>
                )
              )}
              {!locked && isPending && <Countdown target={eventDate} />}
              </div>

              {/* Site logo — pushed right, slightly left so ribbon overlaps */}
              <img src="/pronos_club.png" alt="PRONOS.CLUB" className="ml-auto mr-6 h-[42px] w-auto flex-shrink-0" />
            </div>

            {/* Row 2: selections */}
            <div className="mt-2">
              {locked ? (
                <div className="mt-3 flex flex-col items-center gap-3 rounded-xl bg-white/5 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                      <span className="text-lg">🔒</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Pronostic réservé aux membres Premium</p>
                      <p className="text-[11px] text-white/40">Sélection, cote, analyse et ticket disponibles</p>
                    </div>
                  </div>
                  <Link
                    href="/fr/abonnement"
                    className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-center text-xs font-bold text-white transition hover:shadow-lg hover:shadow-amber-500/20"
                  >
                    Débloquer pour 20€/mois →
                  </Link>
                </div>
              ) : (
                <>
                  {/* Selections */}
                  {isCombi && !locked ? (
                    <div className="space-y-2">
                      {legs.map((leg) => {
                        const legStatus = STATUS_CONFIG[leg.status] ?? STATUS_CONFIG.pending;
                        const legResolved = leg.status !== "pending";
                        const legSport = leg.sport ?? pick.sport;
                        return (
                          <div key={leg.leg_number} className="rounded-lg bg-white/5 px-3 py-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="text-[10px] font-bold text-white/30">#{leg.leg_number}</span>
                                <span className="text-xs">{legSport?.icon}</span>
                                <span className="text-[11px] font-semibold text-white/60">{legSport?.name_fr}</span>
                                {leg.competition && <span className="text-[11px] text-white/45">{leg.competition}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <time className="text-[11px] tabular-nums text-white/50">
                                  {new Date(leg.event_date ?? pick.event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}{" "}
                                  {new Date(leg.event_date ?? pick.event_date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </time>
                                {legResolved && (
                                  <span className={`text-[10px] font-bold ${legStatus.color}`}>
                                    {legStatus.icon} {legStatus.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-xs font-semibold text-white/80">{leg.event_name}</span>
                              <span className="text-white/20">—</span>
                              <span className="text-sm">🎯</span>
                              <span className={`text-sm font-bold ${
                                leg.status === "won" || leg.status === "half_won" ? "text-emerald-400"
                                : leg.status === "lost" || leg.status === "half_lost" ? "text-red-400"
                                : leg.status === "void" ? "text-neutral-400"
                                : "text-white"
                              }`}>
                                {leg.selection}
                              </span>
                              <span className={`ml-auto rounded-md px-1.5 py-0.5 text-xs font-mono font-bold ${
                                leg.status === "won" || leg.status === "half_won" ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                                : leg.status === "lost" || leg.status === "half_lost" ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                                : leg.status === "void" ? "bg-neutral-500/15 text-neutral-400 ring-1 ring-neutral-500/30"
                                : "bg-white/5 text-white/60 ring-1 ring-white/10"
                              }`}>@{leg.odds}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : !locked && (
                    <div className="rounded-lg bg-white/5 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-xs">{pick.sport?.icon}</span>
                          <span className="text-[11px] font-semibold text-white/60">{pick.sport?.name_fr}</span>
                          {pick.competition && <span className="text-[11px] text-white/45">{pick.competition}</span>}
                        </div>
                        <time className="text-[11px] tabular-nums text-white/50">
                          {eventDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}{" "}
                          {eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </time>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs font-semibold text-white/80">{pick.event_name}</span>
                        <span className="text-white/20">—</span>
                        <span className="text-sm">🎯</span>
                        <span className={`text-sm font-bold ${
                          pick.status === "won" || pick.status === "half_won" ? "text-emerald-400"
                          : pick.status === "lost" || pick.status === "half_lost" ? "text-red-400"
                          : pick.status === "void" ? "text-neutral-400"
                          : "text-white"
                        }`}>
                          {pick.selection}
                        </span>
                        <span className={`ml-auto rounded-md px-1.5 py-0.5 text-xs font-mono font-bold ${
                          pick.status === "won" || pick.status === "half_won" ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                          : pick.status === "lost" || pick.status === "half_lost" ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                          : pick.status === "void" ? "bg-neutral-500/15 text-neutral-400 ring-1 ring-neutral-500/30"
                          : "bg-white/5 text-white/60 ring-1 ring-white/10"
                        }`}>@{pick.odds}</span>
                      </div>
                    </div>
                  )}

                  {/* Row 4: analysis (compact) */}
                  {pick.analysis_fr && (
                    <p className="mt-1.5 line-clamp-2 text-center text-[12px] leading-relaxed text-white/40">
                      {pick.analysis_fr}
                    </p>
                  )}

                  {/* Row 5: bottom bar — cote | mise | bookmaker ... status */}
                  <div className="mt-3 flex items-stretch gap-2">
                    {/* Left: cote + mise + bookmaker */}
                    <div className="flex items-stretch gap-2">
                      {/* Cote */}
                      <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5">
                        <span
                          className="font-mono text-sm font-extrabold"
                          style={{ color: colors.accent }}
                        >
                          {pick.odds}
                        </span>
                        {pick.min_odds && (
                          <span className="text-[9px] font-bold text-white/30" title="Cote minimum">
                            min {pick.min_odds}
                          </span>
                        )}
                      </div>

                      {/* Mise */}
                      <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5">
                        <span className="text-[11px] font-bold text-white/60">{pick.stake}U</span>
                        {tipsterUnitEuro > 0 && (
                          <span className="text-[10px] text-white/30">({(pick.stake * tipsterUnitEuro).toFixed(0)}€)</span>
                        )}
                      </div>

                      {/* Bookmaker */}
                      {pick.bookmaker && (
                        <Link
                          href={`/fr/bookmakers/${pick.bookmaker.slug ?? pick.bookmaker.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                          className="flex items-center rounded-lg bg-white/5 px-2.5 transition hover:bg-white/10"
                          title={pick.bookmaker.name}
                        >
                          <span className="text-[11px] font-semibold text-white/60">{pick.bookmaker.name}</span>
                        </Link>
                      )}

                      {/* Bet link */}
                      {pick.bet_url && (
                        <a
                          href={pick.bet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg px-2.5 transition hover:opacity-80"
                          style={{ backgroundColor: `${colors.accent}25` }}
                        >
                          <span className="text-xs">🔗</span>
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: colors.accent }}
                          >
                            Lien Prono
                          </span>
                        </a>
                      )}
                    </div>

                    {/* Right: status + profit (use userProfit in personal history, else tipster profit) */}
                    {(() => {
                      const displayProfit = userProfit !== undefined && userProfit !== null ? userProfit : pick.profit;
                      return isAwaitingResult ? (
                        <div className="ml-auto flex items-center gap-1 rounded-lg bg-white/5 px-2.5">
                          <span className="text-xs">⏳</span>
                          <span className="text-[11px] font-bold text-blue-400">En attente</span>
                        </div>
                      ) : pick.status === "pending" ? (
                        <div className="ml-auto flex items-center gap-1 rounded-lg bg-white/5 px-2.5">
                          <span className="text-xs">{status.icon}</span>
                          <span className="text-[11px] font-bold text-white/50">{status.label}</span>
                        </div>
                      ) : pick.status === "won" || pick.status === "half_won" ? (
                        <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 shadow-md shadow-emerald-500/20">
                          <span className="text-xs">{status.icon}</span>
                          <span className="text-[11px] font-extrabold text-emerald-950">{status.label}</span>
                          {displayProfit !== null && displayProfit !== 0 && (
                            <span className="text-[11px] font-extrabold text-emerald-950">
                              +{displayProfit}U
                              {tipsterUnitEuro > 0 && <span className="ml-0.5 text-[9px] font-bold text-emerald-950/60">({(displayProfit * tipsterUnitEuro).toFixed(0)}€)</span>}
                            </span>
                          )}
                        </div>
                      ) : pick.status === "lost" || pick.status === "half_lost" ? (
                        <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 shadow-md shadow-red-500/20">
                          <span className="text-xs">{status.icon}</span>
                          <span className="text-[11px] font-extrabold text-white">{status.label}</span>
                          {displayProfit !== null && displayProfit !== 0 && (
                            <span className="text-[11px] font-extrabold text-white/90">
                              {displayProfit}U
                              {tipsterUnitEuro > 0 && <span className="ml-0.5 text-[9px] font-bold text-white/60">({(displayProfit * tipsterUnitEuro).toFixed(0)}€)</span>}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-500 px-3 py-1.5 shadow-md shadow-neutral-500/20">
                          <span className="text-xs">{status.icon}</span>
                          <span className="text-[11px] font-extrabold text-white">{status.label}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Follow toggle — full width */}
                  {user && (
                    pick.is_premium && !isPremiumUser ? (
                      <div className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-[11px] font-bold text-white/20">
                        <span>🔒</span>
                        Réservé aux membres Premium
                      </div>
                    ) : (
                    <button
                      onClick={openFollowModal}
                      disabled={followLoading}
                      className={`mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-[11px] font-bold transition ${
                        followed
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                      }`}
                    >
                      {followed ? (
                        <span className="flex items-center gap-2">
                          ✓ Ajouté à vos stats
                          {(userOdds || userBookName) && (
                            <span className="text-[10px] font-normal text-emerald-400/60">
                              {userOdds ? `@${userOdds}` : ""}{userOdds && userBookName ? " sur " : ""}{userBookName || ""}
                            </span>
                          )}
                        </span>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          Prono suivi ? Cliquez ici pour l&apos;ajouter à vos stats persos
                        </>
                      )}
                    </button>
                    )
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Lightbox */}
      {showScreenshot && pick.screenshot_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowScreenshot(false)}
        >
          <div
            className="relative flex max-h-[90vh] max-w-lg flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={pick.screenshot_url}
              alt="Ticket"
              className="max-h-[70vh] rounded-2xl border border-white/10 shadow-2xl"
            />
            <button
              onClick={() => setShowScreenshot(false)}
              className="absolute -right-3 -top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-lg font-bold text-neutral-900 shadow-lg transition hover:bg-neutral-200"
            >
              ×
            </button>

            {/* CTA bookmaker */}
            {pick.bookmaker && (
              <Link
                href={`/fr/bookmakers/${pick.bookmaker.slug ?? pick.bookmaker.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-500 hover:-translate-y-0.5"
                onClick={() => setShowScreenshot(false)}
              >
                🎯 Suivez ce prono sur {pick.bookmaker.name} →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Follow modal — custom odds & bookmaker */}
      {showFollowModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowFollowModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Ajouter à mes stats</p>
              <p className="mt-2 text-sm font-bold text-white">{pick.event_name}</p>
              <p className="mt-0.5 text-xs text-white/40">{pick.selection}</p>
            </div>

            <div className="space-y-4 px-5 pb-5">
              {/* Monetary mise info — if bankroll configured */}
              {bkConfig && bkConfig.mode !== "units_only" && (
                <div className="rounded-lg bg-white/5 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Votre mise à jouer</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {pick.stake}U soit{" "}
                    <span className="text-emerald-400">
                      {(pick.stake * (
                        bkConfig.mode === "fixed_unit"
                          ? bkConfig.unit_value
                          : (bkConfig.current_bankroll * bkConfig.unit_percent) / 100
                      )).toFixed(2)}€
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/20">
                    Bankroll : {bkConfig.current_bankroll.toLocaleString("fr-FR")}€
                  </p>
                </div>
              )}
              {/* User odds — per leg for combined, single for simple */}
              {isCombi ? (
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                    Vos cotes par sélection
                  </label>
                  <div className="space-y-2">
                    {legs.map((leg) => (
                      <div key={leg.leg_number} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-white/60">{leg.event_name}</p>
                          <p className="truncate text-[10px] text-white/30">{leg.selection}</p>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="1.01"
                          value={userLegOdds[leg.leg_number] ?? ""}
                          onChange={(e) => updateLegOdds(leg.leg_number, e.target.value)}
                          className="w-20 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-2 text-center font-mono text-sm font-bold text-white outline-none transition focus:border-emerald-500"
                          inputMode="decimal"
                          autoFocus={leg.leg_number === 1}
                        />
                      </div>
                    ))}
                  </div>
                  {/* Combined odds display */}
                  <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/60">Cote combinée : </span>
                    <span className="font-mono text-sm font-extrabold text-emerald-400">{userOdds}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                    À quelle cote avez-vous pris ce prono ?
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    value={userOdds}
                    onChange={(e) => setUserOdds(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center font-mono text-lg font-bold text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    inputMode="decimal"
                    autoFocus
                  />
                </div>
              )}

              {/* User bookmaker */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                  Sur quel bookmaker ?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {bookmakers.filter((b) => b.active).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => { setUserBookmakerId(b.id); setUserBookOther(""); }}
                      className={`cursor-pointer rounded-lg px-2 py-2.5 text-[11px] font-bold transition ${
                        userBookmakerId === b.id
                          ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                          : "bg-white/5 text-white/40 hover:bg-white/10"
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setUserBookmakerId("other")}
                    className={`cursor-pointer rounded-lg px-2 py-2.5 text-[11px] font-bold transition ${
                      userBookmakerId === "other"
                        ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                        : "bg-white/5 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    Autre
                  </button>
                </div>

                {userBookmakerId === "other" && (
                  <input
                    type="text"
                    value={userBookOther}
                    onChange={(e) => setUserBookOther(e.target.value)}
                    placeholder="Nom du bookmaker"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-center text-sm text-white placeholder-white/30 outline-none transition focus:border-emerald-500"
                  />
                )}
              </div>

              {/* Confirm */}
              <button
                onClick={confirmFollow}
                disabled={!userOdds || (!userBookmakerId)}
                className="w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-30"
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
                }}
              >
                ✅ Valider
              </button>

              <button
                onClick={() => setShowFollowModal(false)}
                className="w-full cursor-pointer py-2 text-xs text-white/30 transition hover:text-white/50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}