"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Bookmaker {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  sort_order: number;
  affiliate_url: string | null;
  is_arjel: boolean;
}

export default function AdminBookmakersPage() {
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/bookmakers")
      .then((r) => r.json())
      .then((data: Bookmaker[]) => {
        const bks = Array.isArray(data) ? data : [];
        setBookmakers(bks);
        const map: Record<string, string> = {};
        bks.forEach((b) => { map[b.id] = b.affiliate_url ?? ""; });
        setLinks(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function saveLink(bk: Bookmaker) {
    setSaving(bk.id);
    setSaved(null);

    try {
      const res = await fetch("/api/admin/bookmakers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bk.id, affiliate_url: links[bk.id] }),
      });

      if (res.ok) {
        setSaved(bk.id);
        setTimeout(() => setSaved(null), 3000);
      }
    } catch {}

    setSaving(null);
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 [color-scheme:dark] placeholder-white/20";

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-sm text-white/30">Chargement...</p>
        </div>
      </main>
    );
  }

  const arjel = bookmakers.filter((b) => b.is_arjel);
  const horsArjel = bookmakers.filter((b) => !b.is_arjel);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(59,130,246,0.15)" }}>
          <span className="text-lg">📚</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Bookmakers</h1>
          <p className="text-xs text-white/30">Gérez vos liens d&apos;affiliation</p>
        </div>
      </div>

      {/* Hors Arjel */}
      {horsArjel.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-500">Hors ANJ — International</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="mt-3 space-y-3">
            {horsArjel.map((bk) => (
              <div
                key={bk.id}
                className="rounded-xl border border-white/[0.06] p-4"
                style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={bk.logo_url || `/bookmakers/${bk.slug}.png`}
                    alt={bk.name}
                    className="h-10 w-[60px] rounded-lg object-cover"
                  />
                  <p className="text-sm font-bold text-white">{bk.name}</p>
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-400">International</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="url"
                    value={links[bk.id] ?? ""}
                    onChange={(e) => setLinks({ ...links, [bk.id]: e.target.value })}
                    placeholder="https://affiliate.example.com/?ref=pronosclub"
                    className={inputClass}
                  />
                  <button
                    onClick={() => saveLink(bk)}
                    disabled={saving === bk.id}
                    className="flex-shrink-0 cursor-pointer rounded-lg px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                    style={{ background: saved === bk.id ? "#047857" : "#059669" }}
                  >
                    {saving === bk.id ? "..." : saved === bk.id ? "✅" : "Sauver"}
                  </button>
                </div>
                {links[bk.id] && (
                  <p className="mt-1.5 truncate text-[10px] text-emerald-400/50">{links[bk.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arjel */}
      {arjel.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-500">ANJ — France</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <div className="mt-3 space-y-3">
            {arjel.map((bk) => (
              <div
                key={bk.id}
                className="rounded-xl border border-white/[0.06] p-4"
                style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={bk.logo_url || `/bookmakers/${bk.slug}.png`}
                    alt={bk.name}
                    className="h-10 w-[60px] rounded-lg object-cover"
                  />
                  <p className="text-sm font-bold text-white">{bk.name}</p>
                  <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-blue-400">ANJ</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="url"
                    value={links[bk.id] ?? ""}
                    onChange={(e) => setLinks({ ...links, [bk.id]: e.target.value })}
                    placeholder="https://affiliate.example.com/?ref=pronosclub"
                    className={inputClass}
                  />
                  <button
                    onClick={() => saveLink(bk)}
                    disabled={saving === bk.id}
                    className="flex-shrink-0 cursor-pointer rounded-lg px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                    style={{ background: saved === bk.id ? "#047857" : "#059669" }}
                  >
                    {saving === bk.id ? "..." : saved === bk.id ? "✅" : "Sauver"}
                  </button>
                </div>
                {links[bk.id] && (
                  <p className="mt-1.5 truncate text-[10px] text-emerald-400/50">{links[bk.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[10px] text-white/20">
        Les pages publiques des bookmakers sont gérées manuellement dans le code.
        <br />Seuls les liens d&apos;affiliation sont modifiables ici.
      </div>
    </main>
  );
}