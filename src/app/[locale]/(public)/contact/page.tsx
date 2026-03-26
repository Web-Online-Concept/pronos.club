"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ContactPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.pseudo || user?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !subject || !message) return;

    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || "Une erreur est survenue. Réessayez ou contactez-nous à contact@pronos.club");
      }
    } catch {
      setError("Impossible d'envoyer le message. Réessayez ou contactez-nous à contact@pronos.club");
    }

    setSending(false);
  }

  return (
    <>
      {/* Hero */}
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Contact</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">Nous contacter</h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/40">
            Une question, une suggestion ou un problème ? Nous vous répondons sous 24h.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">

        {sent ? (
          <div className="mt-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-neutral-900">Message envoyé !</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Merci pour votre message. Nous vous répondrons à <strong>{email}</strong> dans les meilleurs délais.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-500">Nom / Pseudo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Votre nom"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-500">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-500">Sujet</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Choisir un sujet</option>
                <option value="question">Question générale</option>
                <option value="abonnement">Abonnement Premium</option>
                <option value="technique">Problème technique</option>
                <option value="suggestion">Suggestion / Amélioration</option>
                <option value="partenariat">Partenariat / Affiliation</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-500">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                placeholder="Décrivez votre demande en détail..."
                className="w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !name || !email || !subject || !message}
              className="w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}
            >
              {sending ? "Envoi en cours..." : "Envoyer le message"}
            </button>

            <p className="text-center text-xs text-neutral-400">
              Vous pouvez aussi nous écrire directement à{" "}
              <a href="mailto:contact@pronos.club" className="text-emerald-600 underline">contact@pronos.club</a>
            </p>
          </form>
        )}

        {/* Infos */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
            <span className="text-xl">📧</span>
            <p className="mt-2 text-xs font-semibold text-neutral-700">Email</p>
            <a href="mailto:contact@pronos.club" className="text-xs text-emerald-600">contact@pronos.club</a>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
            <span className="text-xl">⏱️</span>
            <p className="mt-2 text-xs font-semibold text-neutral-700">Délai de réponse</p>
            <p className="text-xs text-neutral-500">Sous 24h</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
            <span className="text-xl">💬</span>
            <p className="mt-2 text-xs font-semibold text-neutral-700">Telegram</p>
            <p className="text-xs text-neutral-500">Groupe Premium</p>
          </div>
        </div>
      </main>
    </>
  );
}