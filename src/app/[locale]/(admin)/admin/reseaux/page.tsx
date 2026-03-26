"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  username: string;
  is_active: boolean;
  sort_order: number;
}

const PLATFORMS = [
  { value: "twitter", label: "X / Twitter", icon: "𝕏" },
  { value: "telegram", label: "Telegram", icon: "✈️" },
  { value: "instagram", label: "Instagram", icon: "📸" },
  { value: "youtube", label: "YouTube", icon: "▶️" },
  { value: "tiktok", label: "TikTok", icon: "🎵" },
  { value: "discord", label: "Discord", icon: "💬" },
  { value: "facebook", label: "Facebook", icon: "📘" },
  { value: "threads", label: "Threads", icon: "🧵" },
];

export default function AdminSocialPage() {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPlatform, setNewPlatform] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newUsername, setNewUsername] = useState("");

  useEffect(() => {
    fetchLinks();
  }, []);

  async function fetchLinks() {
    setLoading(true);
    const res = await fetch("/api/admin/social");
    const data = await res.json();
    setLinks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function addLink() {
    if (!newPlatform || !newUrl || !newUsername) return;
    setSaving(true);

    const res = await fetch("/api/admin/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: newPlatform, url: newUrl, username: newUsername }),
    });

    if (res.ok) {
      const link = await res.json();
      setLinks((prev) => [...prev, link]);
      setCreating(false);
      setNewPlatform("");
      setNewUrl("");
      setNewUsername("");
    }

    setSaving(false);
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch("/api/admin/social", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !isActive }),
    });
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, is_active: !isActive } : l));
  }

  async function deleteLink(id: string) {
    if (!confirm("Supprimer ce réseau social ?")) return;
    await fetch(`/api/admin/social?id=${id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function getPlatformInfo(platform: string) {
    return PLATFORMS.find((p) => p.value === platform) || { label: platform, icon: "🔗" };
  }

  const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 placeholder-white/20";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(59,130,246,0.15)" }}>
            <span className="text-lg">🌐</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Réseaux sociaux</h1>
            <p className="text-xs text-white/30">{links.filter((l) => l.is_active).length} réseau{links.filter((l) => l.is_active).length > 1 ? "x" : ""} actif{links.filter((l) => l.is_active).length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-400"
        >
          + Ajouter
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="mt-4 rounded-xl border border-white/10 p-4" style={{ background: "linear-gradient(135deg, #111 0%, #0a3d2a 100%)" }}>
          <p className="text-sm font-bold text-white">Nouveau réseau social</p>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Plateforme</label>
              <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} className="w-full cursor-pointer rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20">
                <option value="" className="bg-[#1a1a1a] text-white/50">Choisir...</option>
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value} className="bg-[#1a1a1a] text-white">{p.icon} {p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">URL complète</label>
              <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://x.com/pronos_club_" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Nom affiché / Username</label>
              <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="@pronos_club_" className={inputClass} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={addLink} disabled={saving || !newPlatform || !newUrl || !newUsername} className="cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {saving ? "..." : "Ajouter"}
            </button>
            <button onClick={() => setCreating(false)} className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/50">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Links list */}
      {loading ? (
        <div className="mt-8 flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : links.length === 0 && !creating ? (
        <div className="mt-12 text-center">
          <p className="text-4xl">🌐</p>
          <p className="mt-2 text-sm text-white/30">Aucun réseau social configuré</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {links.map((link) => {
            const info = getPlatformInfo(link.platform);
            return (
              <div
                key={link.id}
                className={`flex items-center gap-4 rounded-xl border border-white/[0.06] p-4 transition ${!link.is_active ? "opacity-40" : ""}`}
                style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
              >
                <span className="text-2xl">{info.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{info.label}</p>
                  <p className="text-[10px] text-emerald-400/70">{link.username}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-white/30 transition hover:text-white/50">
                    🔗
                  </a>
                  <button
                    onClick={() => toggleActive(link.id, link.is_active)}
                    className={`relative h-6 w-10 cursor-pointer rounded-full transition ${link.is_active ? "bg-emerald-500" : "bg-neutral-600"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${link.is_active ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  <button onClick={() => deleteLink(link.id)} className="cursor-pointer rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-red-400/50 transition hover:text-red-400">
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}