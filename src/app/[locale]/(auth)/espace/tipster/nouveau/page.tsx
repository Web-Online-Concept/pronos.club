// src/app/[locale]/(auth)/espace/tipster/nouveau/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { BOOKMAKERS } from "@/lib/tipster-bookmakers";

const SPORT_KEYS = [
  "football", "basketball", "tennis", "hockey", "football_us",
  "baseball", "mma", "rugby", "multisports", "autre",
];

export default function NouveauPickPage() {
  const { user } = useAuth();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("pronos_abonnes_form");
  const tSports = useTranslations("pronos_abonnes_sports");

  const [matchDate, setMatchDate] = useState("");
  const [matchHour, setMatchHour] = useState("");
  const [matchMinute, setMatchMinute] = useState("");
  const [sport, setSport] = useState("");
  const [odds, setOdds] = useState("");
  const [pickType, setPickType] = useState<"simple" | "combiné">("simple");
  const [bookmaker, setBookmaker] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t("error_image_too_big"));
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(t("error_image_format"));
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

    if (!matchDate || !matchHour || !matchMinute) {
      setError(t("error_date_required"));
      return;
    }
    if (!sport) {
      setError(t("error_sport_required"));
      return;
    }
    const oddsVal = parseFloat(odds);
    if (!oddsVal || oddsVal <= 1) {
      setError(t("error_odds_invalid"));
      return;
    }
    if (oddsVal > 5) {
      setError(t("error_odds_too_high"));
      return;
    }
    if (!bookmaker) {
      setError(t("error_bookmaker_required"));
      return;
    }
    if (!image) {
      setError(t("error_image_required"));
      return;
    }

    const matchDateTime = new Date(`${matchDate}T${matchHour}:${matchMinute}:00`);
    if (matchDateTime.getTime() < Date.now() + 30 * 60 * 1000) {
      setError(t("error_match_too_soon"));
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("match_date", matchDateTime.toISOString());
    formData.append("sport", sport);
    formData.append("odds", String(oddsVal));
    formData.append("pick_type", pickType);
    formData.append("bookmaker", bookmaker);
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
          <h1 className="text-2xl font-black text-neutral-900">{t("locked_title")}</h1>
          <Link
            href={`/${locale}/espace/abonnement`}
            className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
          >
            {t("locked_cta")}
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
            {t("hero_badge")}
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{t("hero_title")}</h1>
          <p className="mt-2 text-sm text-white/60">
            {t("hero_subtitle")}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="space-y-5 rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
          {/* Image */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              {t("label_image")} <span className="text-red-500">{t("required_mark")}</span>
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
                  <p className="text-sm font-bold text-neutral-600">{t("image_upload_title")}</p>
                  <p className="text-xs text-neutral-400">{t("image_upload_hint")}</p>
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
              {t("label_sport")} <span className="text-red-500">{t("required_mark")}</span>
            </label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
            >
              <option value="">{t("select_placeholder")}</option>
              {SPORT_KEYS.map((key) => {
                const label = tSports(key);
                return <option key={key} value={label}>{label}</option>;
              })}
            </select>
          </div>

          {/* Date + Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                {t("label_date")} <span className="text-red-500">{t("required_mark")}</span>
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
                {t("label_time")} <span className="text-red-500">{t("required_mark")}</span>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={matchHour}
                  onChange={(e) => setMatchHour(e.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
                >
                  <option value="">--</option>
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <select
                  value={matchMinute}
                  onChange={(e) => setMatchMinute(e.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
                >
                  <option value="">--</option>
                  {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-amber-600 -mt-3">
            {t("date_warning_1")}<strong>{t("date_warning_strong")}</strong>{t("date_warning_2")}
          </p>

          {/* Cote */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              {t("label_odds")} <span className="text-red-500">{t("required_mark")}</span>
            </label>
            <input
              type="number"
              step="0.01"
              max="5"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              placeholder={t("odds_placeholder")}
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              {t("odds_hint_1")}<strong className="text-emerald-600">{t("odds_hint_strong")}</strong>
            </p>
          </div>

          {/* Bookmaker */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              {t("label_bookmaker")} <span className="text-red-500">{t("required_mark")}</span>
            </label>
            <select
              value={bookmaker}
              onChange={(e) => setBookmaker(e.target.value)}
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 outline-none focus:border-emerald-500"
            >
              <option value="">{t("bookmaker_placeholder")}</option>
              {BOOKMAKERS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-neutral-400">
              {t("bookmaker_hint")}
            </p>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              {t("label_type")} <span className="text-red-500">{t("required_mark")}</span>
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["simple", "combiné"] as const).map((typeKey) => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setPickType(typeKey)}
                  className={`cursor-pointer rounded-xl px-4 py-3 text-sm font-bold transition ${
                    pickType === typeKey
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {typeKey === "simple" ? t("type_simple") : t("type_combine")}
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
            {saving ? t("submit_saving") : t("submit")}
          </button>

          <Link
            href={`/${locale}/espace/tipster`}
            className="block text-center text-xs font-semibold text-neutral-500 hover:text-neutral-900"
          >
            {t("cancel")}
          </Link>
        </div>
      </div>
    </main>
  );
}