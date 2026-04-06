"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";
import { useTranslations } from "next-intl";

export default function AvisPage() {
  const t = useTranslations("user_review");
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [existingReview, setExistingReview] = useState<{ rating: number; content: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  useEffect(() => {
    if (user?.id) {
      fetch("/api/reviews/check")
        .then((r) => r.json())
        .then((d) => {
          if (d.exists) {
            setAlreadySubmitted(true);
            setExistingReview({ rating: d.rating, content: d.content, status: d.status });
          }
        })
        .catch(() => {});
    }
    setLoading(false);
  }, [user]);

  async function handleSubmit() {
    if (!rating || !content.trim()) {
      setError(t("val_required"));
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/reviews", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, content: content.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setSent(true);
        setEditing(false);
        setAlreadySubmitted(true);
        setExistingReview({ rating, content: content.trim(), status: "pending" });
      } else {
        setError(data.error || t("err_send"));
      }
    } catch {
      setError(t("err_network"));
    }

    setSending(false);
  }

  function startEditing() {
    if (existingReview) {
      setRating(existingReview.rating);
      setContent(existingReview.content);
    }
    setEditing(true);
    setSent(false);
  }

  return (
    <>
      <EspaceHero title={t("hero")} />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">

        {!isPremium ? (
          <div className="mt-4 text-center">
            <span className="text-4xl">⭐</span>
            <h2 className="mt-4 text-lg font-extrabold text-neutral-800">{t("locked_title")}</h2>
            <p className="mt-2 text-sm text-neutral-500">{t("locked_desc")}</p>
          </div>
        ) : (sent || alreadySubmitted) && !editing ? (
          <div className="mt-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-neutral-900">
              {sent ? t("sent_title") : t("already_title")}
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              {sent ? t("sent_desc") : t("already_desc")}
            </p>

            {/* Show existing review */}
            {existingReview && (
              <div className="mt-6 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-left">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className="text-sm" style={{ color: s <= existingReview.rating ? "#f59e0b" : "#d1d5db" }}>★</span>
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {existingReview.status === "approved" ? t("status_approved") : existingReview.status === "pending" ? t("status_pending") : t("status_rejected")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-600">{existingReview.content}</p>
              </div>
            )}

            {/* Edit button */}
            <button
              onClick={startEditing}
              className="mt-4 cursor-pointer rounded-xl border border-neutral-200 px-6 py-2.5 text-sm font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              ✏️ {t("btn_edit")}
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-neutral-500">{t("intro")}</p>

            <div className="mt-6">
              <label className="mb-2 block text-xs font-semibold text-neutral-500">{t("label_rating")}</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="cursor-pointer text-3xl transition hover:scale-110">
                    <span style={{ color: star <= (hoverRating || rating) ? "#f59e0b" : "#d1d5db" }}>★</span>
                  </button>
                ))}
                {rating > 0 && <span className="ml-2 self-center text-sm font-semibold text-amber-600">{rating}/5</span>}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold text-neutral-500">
                {t("label_review")} <span className="text-neutral-300">({content.length}/1000)</span>
              </label>
              <textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 1000))} rows={5} placeholder={t("placeholder")} className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </div>

            {(rating > 0 || content) && (
              <div className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("preview")}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    {(user?.pseudo || user?.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-800">{user?.pseudo || user?.display_name || t("preview_you")}</p>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className="text-xs" style={{ color: s <= rating ? "#f59e0b" : "#d1d5db" }}>★</span>
                      ))}
                    </div>
                  </div>
                </div>
                {content && <p className="mt-2 text-sm text-neutral-600">{content}</p>}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
            )}

            <button onClick={handleSubmit} disabled={sending || !rating || !content.trim()} className="mt-6 w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-50" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
              {sending ? t("btn_sending") : t("btn_submit")}
            </button>

            <p className="mt-3 text-center text-xs text-neutral-400">{t("footer_note")}</p>
          </>
        )}
      </main>
    </>
  );
}