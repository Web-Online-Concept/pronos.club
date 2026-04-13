// src/app/[locale]/(admin)/admin/youtube/page.tsx
"use client";

import { useState, useEffect } from "react";

interface Channel {
  id: string;
  channel_id: string;
  name: string;
  logo_url: string | null;
  category: string;
  is_active: boolean;
  sort_order: number;
  youtube_videos: { count: number }[];
}

export default function AdminYouTubePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);

  // Form state
  const [newChannelId, setNewChannelId] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"tipster" | "media">("media");

  async function loadChannels() {
    const res = await fetch("/api/admin/youtube-channels");
    if (res.ok) {
      const data = await res.json();
      setChannels(data);
    }
    setLoading(false);
  }

  useEffect(() => { loadChannels(); }, []);

  async function handleAdd() {
    if (!newChannelId.trim() || !newName.trim()) return;

    let channelId = newChannelId.trim();
    const match = channelId.match(/channel\/([a-zA-Z0-9_-]+)/);
    if (match) channelId = match[1];

    setAdding(true);
    const res = await fetch("/api/admin/youtube-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_id: channelId,
        name: newName.trim(),
        category: newCategory,
      }),
    });

    if (res.ok) {
      setNewChannelId("");
      setNewName("");
      setNewCategory("media");
      await loadChannels();
    } else {
      const err = await res.json();
      alert(`Erreur: ${err.error}`);
    }
    setAdding(false);
  }

  async function handleFetch() {
    setFetching(true);
    setFetchResult(null);
    try {
      const res = await fetch("/api/admin/trigger-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cron: "auto-videos" }),
      });
      const data = await res.json();
      if (data.error) {
        setFetchResult(`❌ ${data.error}`);
      } else {
        setFetchResult(`✅ ${data.new || 0} nouvelles vidéos · ${data.logos || 0} logos · ${data.skipped || 0} déjà existantes`);
      }
      await loadChannels();
    } catch (err: any) {
      setFetchResult(`❌ Erreur: ${err.message}`);
    }
    setFetching(false);
  }

  async function toggleActive(channel: Channel) {
    await fetch("/api/admin/youtube-channels", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: channel.id, is_active: !channel.is_active }),
    });
    await loadChannels();
  }

  async function handleDelete(channel: Channel) {
    if (!confirm(`Supprimer "${channel.name}" et toutes ses vidéos ?`)) return;
    await fetch(`/api/admin/youtube-channels?id=${channel.id}`, { method: "DELETE" });
    await loadChannels();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">📺 Chaînes YouTube</h1>
      <p className="mt-1 text-sm text-neutral-400">Gérer les chaînes dont les vidéos sont affichées sur la page Vidéos. Le logo est récupéré automatiquement.</p>

      {/* Formulaire d'ajout */}
      <div className="mt-8 rounded-xl border border-neutral-700 bg-neutral-800/50 p-5">
        <h2 className="text-sm font-semibold text-white">Ajouter une chaîne</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            placeholder="Channel ID (UCxxxxx)"
            value={newChannelId}
            onChange={(e) => setNewChannelId(e.target.value)}
            className="rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-emerald-500"
          />
          <input
            type="text"
            placeholder="Nom de la chaîne"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-emerald-500"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as "tipster" | "media")}
            className="rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          >
            <option value="media">📺 Média</option>
            <option value="tipster">🎯 Tipster</option>
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !newChannelId.trim() || !newName.trim()}
          className="mt-3 cursor-pointer rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {adding ? "Ajout..." : "Ajouter"}
        </button>
      </div>

      {/* Bouton fetch manuel — SÉCURISÉ via /api/admin/trigger-cron */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleFetch}
          disabled={fetching || channels.length === 0}
          className="cursor-pointer rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {fetching ? "⏳ Fetch en cours..." : "🔄 Lancer le fetch maintenant"}
        </button>
        {fetchResult && (
          <span className="text-xs text-neutral-400">{fetchResult}</span>
        )}
      </div>

      {/* Liste des chaînes */}
      <div className="mt-8 space-y-3">
        {channels.length === 0 ? (
          <p className="text-center text-neutral-500 py-10">Aucune chaîne configurée</p>
        ) : (
          channels.map((ch) => (
            <div
              key={ch.id}
              className={`flex items-center gap-4 rounded-xl border p-4 transition ${
                ch.is_active
                  ? "border-neutral-700 bg-neutral-800/30"
                  : "border-neutral-800 bg-neutral-900/50 opacity-50"
              }`}
            >
              {ch.logo_url ? (
                <img src={ch.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-700 text-sm font-bold text-neutral-300">
                  {ch.name.charAt(0)}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{ch.name}</p>
                <p className="text-xs text-neutral-500">
                  {ch.channel_id} · {ch.category === "tipster" ? "🎯 Tipster" : "📺 Média"}
                  {" · "}
                  {ch.youtube_videos?.[0]?.count || 0} vidéos
                  {!ch.logo_url && " · ⏳ Logo en attente"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(ch)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    ch.is_active
                      ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                      : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
                  }`}
                >
                  {ch.is_active ? "Actif" : "Inactif"}
                </button>
                <button
                  onClick={() => handleDelete(ch)}
                  className="cursor-pointer rounded-lg bg-red-600/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-600/20"
                >
                  Suppr.
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div className="mt-8 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-xs text-neutral-500">
        <p className="font-semibold text-neutral-400">Comment trouver un Channel ID ?</p>
        <p className="mt-1">1. Aller sur <a href="https://commentpicker.com/youtube-channel-id.php" target="_blank" rel="noopener" className="text-emerald-400 underline">commentpicker.com</a></p>
        <p>2. Coller l'URL de la chaîne YouTube (ex: https://www.youtube.com/@beINSPORTSFrance)</p>
        <p>3. Copier le Channel ID (format UC...)</p>
        <p className="mt-2 text-neutral-400">Le logo de la chaîne est récupéré automatiquement au prochain passage du CRON.</p>
      </div>
    </div>
  );
}