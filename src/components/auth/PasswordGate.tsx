"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth/site-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
    >
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl">
          🔒
        </div>
        <h1 className="text-xl font-extrabold text-white">Site en maintenance</h1>
        <p className="mt-2 text-sm text-white/40">Entrez le mot de passe pour accéder au site</p>

        <form onSubmit={handleSubmit} className="mt-6">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="Mot de passe"
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 [color-scheme:dark] placeholder-white/30"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-xs text-red-400">Mot de passe incorrect</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full cursor-pointer rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
              boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
            }}
          >
            {loading ? "Vérification..." : "Accéder"}
          </button>
        </form>
      </div>
    </div>
  );
}