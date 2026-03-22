"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UserRow {
  id: string;
  email: string;
  pseudo: string | null;
  avatar_url: string | null;
  subscription_status: string;
  subscription_end: string | null;
  created_at: string;
}

const GIFT_OPTIONS = [
  { label: "7 jours", days: 7 },
  { label: "15 jours", days: 15 },
  { label: "1 mois", days: 30 },
  { label: "3 mois", days: 90 },
  { label: "Illimité", days: 0 },
];

export default function AbonnesPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [giftModal, setGiftModal] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data ?? []);
    setLoading(false);
  }

  async function togglePremium(user: UserRow) {
    const isActive = user.subscription_status === "active";

    if (isActive) {
      // Remove premium
      setUpdating(user.id);
      const res = await fetch("/api/admin/user-premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          subscription_status: "free",
          subscription_end: null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? { ...u, subscription_status: updated.subscription_status, subscription_end: updated.subscription_end } : u))
        );
      }
      setUpdating(null);
    } else {
      // Open gift modal to choose duration
      setGiftModal(user);
    }
  }

  async function giftPremium(user: UserRow, days: number) {
    setUpdating(user.id);
    setGiftModal(null);

    const subscriptionEnd = days > 0
      ? new Date(Date.now() + days * 86400000).toISOString()
      : new Date(Date.now() + 365 * 10 * 86400000).toISOString(); // "illimité" = 10 ans

    const res = await fetch("/api/admin/user-premium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        subscription_status: "active",
        subscription_end: subscriptionEnd,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, subscription_status: updated.subscription_status, subscription_end: updated.subscription_end } : u))
      );
    }

    setUpdating(null);
  }

  function formatEnd(end: string | null) {
    if (!end) return null;
    const d = new Date(end);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);

    if (diffDays > 3650) return "Illimité";
    if (diffDays <= 0) return "Expiré";
    if (diffDays === 1) return "Expire demain";
    return `${diffDays}j restants`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.pseudo ?? "").toLowerCase().includes(q)
    );
  });

  const premiumCount = users.filter((u) => u.subscription_status === "active").length;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(167,139,250,0.15)" }}>
            <span className="text-lg">👥</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Abonnés</h1>
            <p className="text-xs text-white/30">
              {users.length} utilisateur{users.length !== 1 ? "s" : ""} · {premiumCount} premium
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par email ou pseudo..."
          className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        />
      </div>

      {/* User list */}
      {loading ? (
        <p className="mt-8 text-center text-sm text-white/30">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-white/30">Aucun utilisateur trouvé</p>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((user) => {
            const isActive = user.subscription_status === "active";
            const endInfo = isActive ? formatEnd(user.subscription_end) : null;
            const isUpdating = updating === user.id;

            return (
              <div
                key={user.id}
                className="overflow-hidden rounded-xl border border-white/[0.06] p-4"
                style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm text-white/40">
                        {(user.pseudo ?? user.email)[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-white">
                        {user.pseudo ?? user.email.split("@")[0]}
                      </p>
                      {isActive ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                          Premium
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
                          Gratuit
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-white/30">{user.email}</p>
                    <div className="mt-0.5 flex gap-3 text-[10px] text-white/20">
                      <span>Inscrit {formatDate(user.created_at)}</span>
                      {isActive && endInfo && (
                        <span className={endInfo === "Expiré" ? "text-red-400" : "text-emerald-400/60"}>
                          {endInfo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => togglePremium(user)}
                    disabled={isUpdating}
                    className={`flex-shrink-0 cursor-pointer rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-30 ${
                      isActive
                        ? "border border-red-500/30 text-red-400 hover:bg-red-500/10"
                        : "bg-emerald-600 text-white hover:bg-emerald-500"
                    }`}
                  >
                    {isUpdating ? "..." : isActive ? "Retirer Premium" : "Offrir Premium"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gift duration modal */}
      {giftModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setGiftModal(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.06] shadow-2xl"
            style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Offrir Premium</p>
              <p className="mt-2 text-sm font-bold text-white">{giftModal.pseudo ?? giftModal.email}</p>
              <p className="mt-0.5 text-xs text-white/30">{giftModal.email}</p>
            </div>

            <div className="space-y-2 px-5 pb-5">
              {GIFT_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => giftPremium(giftModal, opt.days)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                >
                  <span>{opt.label}</span>
                  <span className="text-xs text-white/30">
                    {opt.days > 0
                      ? `→ ${new Date(Date.now() + opt.days * 86400000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
                      : "→ Sans limite"}
                  </span>
                </button>
              ))}

              <button
                onClick={() => setGiftModal(null)}
                className="w-full cursor-pointer py-2 text-xs text-white/30 transition hover:text-white/50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}