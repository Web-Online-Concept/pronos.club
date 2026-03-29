"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import EspaceHero from "@/components/layout/EspaceHero";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

export default function AbonnementPage() {
  const t = useTranslations("subscription");
  const locale = useLocale();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isPremium = user?.subscription_status === "active";

  const FREE_FEATURES = [
    t("free_f1"),
    t("free_f2"),
    t("free_f3"),
    t("free_f4"),
    t("free_f5"),
  ];

  const PREMIUM_FEATURES = [
    t("premium_f1"),
    t("premium_f2"),
    t("premium_f3"),
    t("premium_f4"),
    t("premium_f5"),
    t("premium_f6"),
  ];

  async function handleSubscribe() {
    if (!user) {
      window.location.href = `/${locale}/login`;
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || t("error_generic"));
        setLoading(false);
      }
    } catch {
      setError(t("error_server"));
      setLoading(false);
    }
  }

  async function handleManage() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || t("error_portal"));
        setLoading(false);
      }
    } catch {
      setError(t("error_server"));
      setLoading(false);
    }
  }

  return (
    <>
      <EspaceHero title={t("page_title")} />

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8">

        {/* Current status */}
        {isPremium && (
          <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-bold text-emerald-700">{t("status_active")}</span>
            </div>
            {user?.subscription_end && (
              <p className="mt-1 text-xs text-emerald-600/60">
                {new Date(user.subscription_end).getTime() > Date.now() + 3650 * 86400000
                  ? t("status_unlimited")
                  : t("status_renewal", { date: new Date(user.subscription_end).toLocaleDateString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", { day: "numeric", month: "long", year: "numeric" }) })
                }
              </p>
            )}
          </div>
        )}

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Free */}
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-6"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <div className="text-center">
              <span className="rounded-full bg-neutral-500/20 px-3 py-1 text-[10px] font-bold uppercase text-neutral-400">{t("free_label")}</span>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-white">{t("free_price")}</span>
              </div>
              <p className="mt-1 text-xs text-white/30">{t("free_period")}</p>
            </div>
            <div className="mt-6 flex justify-center"><div className="space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 shrink-0 text-emerald-400/60" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-white/50">{f}</span>
                </div>
              ))}
            </div></div>
            {!user && (
              <div className="mt-6">
                <Link
                  href={`/${locale}/login`}
                  className="block w-full cursor-pointer rounded-xl border border-white/10 py-3 text-center text-sm font-bold text-white/50 transition hover:border-white/20 hover:text-white/70"
                >
                  {t("free_cta")}
                </Link>
              </div>
            )}
          </div>

          {/* Premium */}
          <div
            className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/30 p-6"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <div className="absolute -top-px left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
            <div className="text-center">
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase text-emerald-400">{t("premium_label")}</span>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-white">{t("premium_price")}</span>
                <span className="text-lg text-white/30">{t("premium_period")}</span>
              </div>
              <p className="mt-1 text-xs text-white/30">{t("premium_commitment")}</p>
            </div>
            <div className="mt-6 flex justify-center"><div className="space-y-2.5">
              {PREMIUM_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-white/70">{f}</span>
                </div>
              ))}
            </div></div>

            <div className="mt-6">
              {isPremium ? (
                <button
                  onClick={handleManage}
                  disabled={loading}
                  className="w-full cursor-pointer rounded-xl border-2 border-white/10 py-3 text-sm font-bold text-white/70 transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:opacity-50"
                >
                  {loading ? t("btn_loading") : t("btn_manage")}
                </button>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full cursor-pointer rounded-xl py-3.5 text-base font-bold text-white transition hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}
                >
                  {loading ? t("btn_redirect") : t("btn_subscribe")}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Trust elements */}
        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
          <div>
            <span className="text-2xl">🔒</span>
            <p className="mt-2 text-xs font-semibold text-neutral-600">{t("trust_secure")}</p>
            <p className="text-[10px] text-neutral-400">{t("trust_secure_sub")}</p>
          </div>
          <div>
            <span className="text-2xl">⚡</span>
            <p className="mt-2 text-xs font-semibold text-neutral-600">{t("trust_instant")}</p>
            <p className="text-[10px] text-neutral-400">{t("trust_instant_sub")}</p>
          </div>
          <div>
            <span className="text-2xl">🚫</span>
            <p className="mt-2 text-xs font-semibold text-neutral-600">{t("trust_no_commit")}</p>
            <p className="text-[10px] text-neutral-400">{t("trust_no_commit_sub")}</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-10">
          <h2 className="text-center text-lg font-extrabold text-neutral-800">{t("faq_title")}</h2>
          <div className="mt-4 space-y-2">
            {[
              { q: t("faq_q1"), a: t("faq_a1") },
              { q: t("faq_q2"), a: t("faq_a2") },
              { q: t("faq_q3"), a: t("faq_a3") },
              { q: t("faq_q4"), a: t("faq_a4") },
            ].map((faq) => (
              <details
                key={faq.q}
                className="group overflow-hidden rounded-xl border border-neutral-200 bg-white"
              >
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50">
                  {faq.q}
                  <svg className="h-4 w-4 shrink-0 text-neutral-400 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="border-t border-neutral-100 px-5 py-4 text-sm text-neutral-500 leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>

      </main>
    </>
  );
}