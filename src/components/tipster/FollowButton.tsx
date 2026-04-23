// src/components/tipster/FollowButton.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export default function FollowButton({ tipsterId, locale }: { tipsterId: string; locale: string }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";
  const isSelf = (user as any)?.id === tipsterId;

  useEffect(() => {
    if (!tipsterId) return;

    // R\u00e9cup\u00e9rer le nombre de followers (public)
    fetch(`/api/tipster-follows?action=count&tipster_id=${tipsterId}`)
      .then((r) => r.json())
      .then((d) => setCount(d.count || 0));

    // V\u00e9rifier si le user connect\u00e9 suit
    if (user) {
      fetch(`/api/tipster-follows?action=check&tipster_id=${tipsterId}`)
        .then((r) => r.json())
        .then((d) => {
          setFollowing(!!d.following);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [tipsterId, user]);

  async function handleToggle() {
    if (!user || !isPremium) return;

    if (following) {
      // D\u00e9suivre
      await fetch(`/api/tipster-follows?tipster_id=${tipsterId}`, { method: "DELETE" });
      setFollowing(false);
      setCount(Math.max(0, count - 1));
    } else {
      // Suivre
      await fetch("/api/tipster-follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipster_id: tipsterId }),
      });
      setFollowing(true);
      setCount(count + 1);
    }
  }

  if (isSelf) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-4 py-2">
        <span className="text-xs font-bold text-white/60">👥 {count} follower{count !== 1 ? "s" : ""}</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href={`/${locale}/login`}
        className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
      >
        🔔 Se connecter pour suivre
      </Link>
    );
  }

  if (!isPremium) {
    return (
      <Link
        href={`/${locale}/abonnement`}
        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-white transition"
      >
        💎 Passer Premium pour suivre
      </Link>
    );
  }

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
        following
          ? "bg-white/10 border border-white/20 text-white hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-300"
          : "bg-emerald-500 hover:bg-emerald-400 border border-emerald-400 text-white"
      }`}
    >
      {following ? (
        <>
          <span>✓ Suivi</span>
          <span className="text-white/50">·</span>
          <span>{count}</span>
        </>
      ) : (
        <>
          <span>🔔 Suivre</span>
          <span className="text-white/70">·</span>
          <span>{count}</span>
        </>
      )}
    </button>
  );
}