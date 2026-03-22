"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

export default function ProfilPage() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pseudo, setPseudo] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync states when user data loads
  useEffect(() => {
    if (user) {
      setPseudo(user.pseudo ?? user.display_name ?? "");
      setAvatarUrl(user.avatar_url ?? "");
      setAvatarPreview(user.avatar_url ?? "");
    }
  }, [user]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/user/avatar", {
      method: "POST",
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      setAvatarUrl(data.url);
    } else {
      console.error("Avatar upload failed:", res.status, data);
      alert(`Erreur upload avatar (${res.status}): ${data.error ?? JSON.stringify(data)}`);
    }

    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pseudo: pseudo || null,
        avatar_url: avatarUrl || null,
      }),
    });

    await refreshUser();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const initial = (pseudo || user?.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <EspaceHero title="Mon Profil" />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">

        {/* Avatar */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
          <div className="p-6 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Photo de profil</p>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative cursor-pointer"
              >
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/20 transition group-hover:ring-emerald-500/50">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/20 text-3xl font-bold text-white">
                      {initial}
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <span className="text-sm font-bold text-white">📷</span>
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {uploading && (
              <p className="mt-2 text-xs text-white/40">Upload en cours...</p>
            )}

            <p className="mt-3 text-xs text-white/30">Cliquez sur la photo pour la modifier</p>

            {avatarPreview && (
              <button
                type="button"
                onClick={() => {
                  setAvatarPreview("");
                  setAvatarUrl("");
                }}
                className="mt-2 cursor-pointer text-xs text-red-400 transition hover:text-red-300"
              >
                Supprimer la photo
              </button>
            )}
          </div>
        </div>

        {/* Pseudo */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
          <div className="p-6 text-center">
            <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Pseudo</label>
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              placeholder="Votre pseudo"
              maxLength={30}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-sm text-white placeholder-white/30 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <p className="mt-2 text-xs text-white/30">Visible dans vos avis et votre espace</p>
          </div>
        </div>

        {/* Email (read-only) */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
          <div className="p-6 text-center">
            <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Email</label>
            <div className="mt-3 flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <svg className="h-4 w-4 shrink-0 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-white/50">{user?.email}</span>
            </div>
            <p className="mt-2 text-xs text-white/30">Connexion par magic link — non modifiable</p>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
              boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
            }}
          >
            {saving ? "Enregistrement..." : saved ? "✅ Profil enregistré" : "Enregistrer les modifications"}
          </button>
        </div>

      </main>
    </>
  );
}