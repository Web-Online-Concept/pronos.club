"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTranslations } from "next-intl";

export default function ContactPage() {
  const t = useTranslations("contact");
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
        setError(data.error || t("error_generic"));
      }
    } catch {
      setError(t("error_network"));
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
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("hero_tag")}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">{t("hero_title")}</h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/40">
            {t("hero_subtitle")}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">

        {sent ? (
          <div className="mt-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-neutral-900">{t("sent_title")}</h2>
            <p className="mt-2 text-sm text-neutral-500">{t("sent_desc")}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-600">{email}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-500">{t("label_name")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t("placeholder_name")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-500">{t("label_email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("placeholder_email")}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-500">{t("label_subject")}</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">{t("placeholder_subject")}</option>
                <option value="question">{t("subject_question")}</option>
                <option value="abonnement">{t("subject_subscription")}</option>
                <option value="technique">{t("subject_technical")}</option>
                <option value="suggestion">{t("subject_suggestion")}</option>
                <option value="partenariat">{t("subject_partnership")}</option>
                <option value="autre">{t("subject_other")}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-neutral-500">{t("label_message")}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                placeholder={t("placeholder_message")}
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
              {sending ? t("btn_sending") : t("btn_send")}
            </button>

            <p className="text-center text-xs text-neutral-400">
              {t("also_email")}{" "}
              <a href="mailto:contact@pronos.club" className="text-emerald-600 underline">contact@pronos.club</a>
            </p>
          </form>
        )}

        {/* Infos */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
            <span className="text-xl">📧</span>
            <p className="mt-2 text-xs font-semibold text-neutral-700">{t("info_email")}</p>
            <a href="mailto:contact@pronos.club" className="text-xs text-emerald-600">contact@pronos.club</a>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
            <span className="text-xl">⏱️</span>
            <p className="mt-2 text-xs font-semibold text-neutral-700">{t("info_response")}</p>
            <p className="text-xs text-neutral-500">{t("info_response_value")}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
            <span className="text-xl">💬</span>
            <p className="mt-2 text-xs font-semibold text-neutral-700">{t("info_telegram")}</p>
            <p className="text-xs text-neutral-500">{t("info_telegram_value")}</p>
          </div>
        </div>
      </main>
    </>
  );
}