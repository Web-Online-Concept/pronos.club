"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }

    setLoading(false);
  }

  if (sent) {
    return (
      <main className="relative flex min-h-[calc(100vh-100px)] items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 60%)" }} />

        <div className="relative w-full max-w-sm text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-neutral-900">
            Vérifiez votre boîte mail
          </h1>
          <p className="mt-3 text-sm text-neutral-500">
            Un lien de connexion a été envoyé à
          </p>
          <p className="mt-1 rounded-lg bg-emerald-50 px-4 py-2 font-mono text-sm font-bold text-emerald-700">
            {email}
          </p>
          <p className="mt-6 text-xs text-neutral-400">
            Cliquez sur le lien dans l&apos;email pour accéder à vos pronostics.
            <br />
            Pensez à vérifier vos spams si vous ne le voyez pas.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[calc(100vh-100px)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(30,58,95,0.06) 0%, transparent 50%)" }} />

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .fade-in-1 { animation: fadeInUp 0.6s ease-out both; }
        .fade-in-2 { animation: fadeInUp 0.6s ease-out 0.1s both; }
        .fade-in-3 { animation: fadeInUp 0.6s ease-out 0.2s both; }
        .fade-in-4 { animation: fadeInUp 0.6s ease-out 0.3s both; }
        .fade-in-5 { animation: fadeInUp 0.6s ease-out 0.4s both; }
      `}</style>

      <div className="relative grid w-full max-w-4xl gap-10 lg:grid-cols-2 lg:items-center">

        {/* Left — pitch */}
        <div className="fade-in-1 text-center">
          <div className="animate-float mx-auto mb-6 flex justify-center">
            <img
              src="/pronos_club.png"
              alt="PRONOS.CLUB"
              className="h-36 w-36 object-contain"
            />
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">
            Espace membres
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 lg:text-4xl">
            Accédez à nos
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent"> pronostics</span>
          </h1>
          <p className="mt-3 text-base text-neutral-500">
            Rejoignez la communauté et profitez de picks analysés par notre tipster professionnel.
          </p>

          <div className="fade-in-2 mt-6 flex justify-center gap-6">
            <div>
              <p className="text-center text-2xl font-extrabold text-emerald-600">100%</p>
              <p className="text-center text-[11px] text-neutral-400">Transparent</p>
            </div>
            <div className="h-10 w-px bg-neutral-200" />
            <div>
              <p className="text-center text-2xl font-extrabold text-neutral-900">1U</p>
              <p className="text-center text-[11px] text-neutral-400">Flat bet</p>
            </div>
            <div className="h-10 w-px bg-neutral-200" />
            <div>
              <p className="text-center text-2xl">⚡</p>
              <p className="text-center text-[11px] text-neutral-400">Alertes instantanées</p>
            </div>
          </div>
        </div>

        {/* Right — form card */}
        <div className="fade-in-3 relative">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-800/10 blur-2xl" />

          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] px-6 py-8 shadow-xl sm:px-8" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
            <h2 className="text-center text-lg font-extrabold text-white">
              Connexion / Inscription
            </h2>
            <p className="mt-1 text-center text-xs text-white/40">
              Déjà membre ou nouveau ? Même formulaire — entrez votre email
            </p>

            <div className="mt-6 space-y-2.5">
              <div className="fade-in-3 flex items-center gap-3 rounded-xl bg-white/[0.05] px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Inscription gratuite sans engagement</p>
                  <p className="text-[11px] text-white/40">Pas de CB, pas de mot de passe, un mail suffit</p>
                </div>
              </div>

              <div className="fade-in-4 flex items-center gap-3 rounded-xl bg-white/[0.05] px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Pronostics gratuits inclus</p>
                  <p className="text-[11px] text-white/40">Accédez aux picks gratuits dès votre inscription</p>
                </div>
              </div>

              <div className="fade-in-5 flex items-center gap-3 rounded-xl bg-white/[0.05] px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Alertes en temps réel</p>
                  <p className="text-[11px] text-white/40">Push, email et Telegram</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                  <svg className="h-4 w-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3.5 pl-11 pr-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer rounded-xl px-4 py-3.5 text-sm font-bold text-white transition disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(16,185,129,0.4)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(16,185,129,0.3)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Envoi en cours...
                  </span>
                ) : (
                  "Recevoir mon lien de connexion →"
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] text-white/30">
              Nouveau ? Votre compte sera créé automatiquement.
              <br />
              Déjà inscrit ? Vous serez reconnecté en un clic.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}