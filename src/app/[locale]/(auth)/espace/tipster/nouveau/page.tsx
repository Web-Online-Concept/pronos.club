// src/app/[locale]/(auth)/espace/tipster/nouveau/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

const SPORTS = [
  "⚽ Football",
  "🏀 Basketball",
  "🎾 Tennis",
  "🏒 Hockey",
  "🏈 Football US",
  "⚾ Baseball",
  "🥊 MMA/Boxe",
  "🏉 Rugby",
  "🎯 Autre",
];

export default function NouveauPickPage() {
  const { user } = useAuth();
  const locale = useLocale();
  const router = useRouter();

  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [sport, setSport] = useState("");
  const [odds, setOdds] = useState("");
  const [pickType, setPickType] = useState<"simple" | "combiné">("simple");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image trop lourde (max 5 Mo)");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format invalide (JPG, PNG, WEBP)");
      return;
    }
    setError("");
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    setError("");

    if (!matchDate || !matchTime) {
      setError("Date et heure du match requises");
      return;
    }
    if (!sport) {
      setError("Sport requis");
      return;
    }
    const oddsVal = parseFloat(odds);
    if (!oddsVal || oddsVal <= 1) {
      setError("Cote invalide (> 1.00)");
      return;
    }
    if (oddsVal > 5) {
      setError("Cote trop élevée (max 5.00)");
      return;
    }
    if (!image) {
      setError("Screen du pronostic requis");
      return;
    }

    // Vérif match commence dans +5min
    const matchDateTime = new Date(`${matchDate}T${matchTime}:00`);
    if (matchDateTime.getTime() < Date.now() + 5 * 60 * 1000) {
      setError("Le match doit commencer dans au moins 5 minutes");
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("match_date", matchDateTime.toISOString());
    formData.append("sport", sport);
    formData.append("odds", String(oddsVal));
    formData.append("pick_type", pickType);
    formData.append("image", image);

    const res = await fetch("/api/tipster-picks", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSaving(false);
      return;
    }
    router.push(`/${locale}/espace/tipster`);
  }

  if (!isPremium) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-black text-neutral-900">Accès Premium requis</h1>
          <Link
            href={`/${locale}/espace/abonnement`}
            className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
          >
            Voir les offres
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div
        className="px-4 py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-2xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            🎯 Nouveau pronostic
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Poster un pronostic</h1>
          <p className="mt-2 text-sm text-white/60">
            3 pronostics max par jour · Le match doit commencer dans +5 min
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="space-y-5 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
          {/* Image */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Screen du ticket <span className="text-red-500">*</span>
            </label>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full rounded-xl border-2 border-neutral-200"
                  />
                  <button
                    onClick={() => { setImage(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 rounded-full bg-white/90 p-2 shadow-lg hover:bg-white"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 py-10 transition hover:border-emerald-500 hover:bg-emerald-50">
                  <span className="text-4xl mb-2">📸</span>
                  <p className="text-sm font-bold text-neutral-600">Uploader un screen</p>
                  <p className="text-xs text-neutral-400">JPG, PNG, WEBP · max 5 Mo</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Sport */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Sport <span className="text-red-500">*</span>
            </label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
            >
              <option value="">— Choisir —</option>
              {SPORTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Date + Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Date 1er match <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Heure <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={matchTime}
                onChange={(e) => setMatchTime(e.target.value)}
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Cote */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Cote totale <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              max="5"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              placeholder="1.85"
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Cote maximum : <strong className="text-emerald-600">5.00</strong>
            </p>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Type de pari <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["simple", "combiné"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPickType(t)}
                  className={`cursor-pointer rounded-xl px-4 py-3 text-sm font-bold transition ${
                    pickType === t
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {t === "simple" ? "Simple" : "Combiné"}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm font-bold text-red-600">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="cursor-pointer w-full rounded-xl bg-emerald-600 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "Publication en cours..." : "🎯 Publier le pronostic"}
          </button>

          <Link
            href={`/${locale}/espace/tipster`}
            className="block text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            ← Annuler
          </Link>
        </div>
      </div>
    </main>
  );
}