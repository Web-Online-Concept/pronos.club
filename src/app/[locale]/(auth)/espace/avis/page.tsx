"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

export default function AvisPage() {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  const isPremium = user?.subscription_status === "active";

  useEffect(() => {
    // Check if user already submitted
    fetch("/api/reviews?admin=false")
      .then(() => {
        // We check via a dedicated call
        if (user?.id) {
          fetch(`/api/reviews/check`)
            .then((r) => r.json())
            .then((d) => {
              if (d.exists) setAlreadySubmitted(true);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    setLoading(false);
  }, [user]);

  async function handleSubmit() {
    if (!rating || !content.trim()) {
      setError("Veuillez donner une note et écrire votre avis");
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, content: content.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || "Erreur lors de l'envoi");
      }
    } catch {
      setError("Erreur réseau");
    }

    setSending(false);
  }

  return (
    <>
      <EspaceHero title="Mon Avis" />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">

        {!isPremium ? (
          <div className="mt-4 text-center">
            <span className="text-4xl">⭐</span>
            <h2 className="mt-4 text-lg font-extrabold text-neutral-800">Réservé aux abonnés Premium</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Seuls les abonnés Premium peuvent laisser un avis. Abonnez-vous pour partager votre expérience.
            </p>
          </div>
        ) : sent || alreadySubmitted ? (
          <div className="mt-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-neutral-900">
              {sent ? "Merci pour votre avis !" : "Avis déjà envoyé"}
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              {sent
                ? "Votre avis a été soumis et sera visible sur le site après vérification par notre équipe."
                : "Vous avez déjà soumis un avis. Il sera visible sur le site après vérification."
              }
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-neutral-500">
              Votre avis compte ! Partagez votre expérience avec PRONOS.CLUB. Votre avis sera publié 
              après vérification par notre équipe.
            </p>

            {/* Stars */}
            <div className="mt-6">
              <label className="mb-2 block text-xs font-semibold text-neutral-500">Votre note</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="cursor-pointer text-3xl transition hover:scale-110"
                  >
                    <span style={{ color: star <= (hoverRating || rating) ? "#f59e0b" : "#d1d5db" }}>
                      ★
                    </span>
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 self-center text-sm font-semibold text-amber-600">
                    {rating}/5
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold text-neutral-500">
                Votre avis <span className="text-neutral-300">({content.length}/1000)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 1000))}
                rows={5}
                placeholder="Qu'est-ce que vous appréciez le plus ? Qu'est-ce qui pourrait être amélioré ? Votre expérience en quelques mots..."
                className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Preview */}
            {(rating > 0 || content) && (
              <div className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Aperçu</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                    {(user?.pseudo || user?.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-neutral-800">{user?.pseudo || user?.display_name || "Vous"}</p>
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
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={sending || !rating || !content.trim()}
              className="mt-6 w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}
            >
              {sending ? "Envoi en cours..." : "Soumettre mon avis"}
            </button>

            <p className="mt-3 text-center text-xs text-neutral-400">
              Votre avis sera vérifié avant publication. Pseudo et avatar seront affichés publiquement.
            </p>
          </>
        )}
      </main>
    </>
  );
}