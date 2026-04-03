"use client";

import { useState, useEffect } from "react";
import EspaceHero from "@/components/layout/EspaceHero";
import { useTranslations } from "next-intl";

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function AppMobilePage() {
  const t = useTranslations("app_mobile");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    function handlePrompt(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setInstallPrompt(null);
  }

  const WHY_ICONS = ["🔔", "📱", "⚡", "🚫", "🆓"];

  return (
    <>
      <EspaceHero title={t("hero")} />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
        <p className="text-sm text-neutral-500">{t("intro")}</p>

        {/* Install button — visible on Android Chrome when PWA is available */}
        {installPrompt && !installed && (
          <div className="mt-6 overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-500 to-emerald-600 p-5 text-center shadow-lg shadow-emerald-500/20">
            <p className="text-2xl">📲</p>
            <p className="mt-2 text-lg font-extrabold text-white">Installer PRONOS.CLUB</p>
            <p className="mt-1 text-sm text-emerald-100">En un clic, ajoutez l'application à votre écran d'accueil</p>
            <button
              onClick={handleInstall}
              className="mt-4 w-full cursor-pointer rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-emerald-700 shadow-md transition hover:bg-emerald-50 active:scale-[0.98]"
            >
              Installer l'application →
            </button>
          </div>
        )}

        {installed && (
          <div className="mt-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-2 text-sm font-bold text-emerald-700">Application installée !</p>
            <p className="mt-1 text-xs text-emerald-600">Ouvrez PRONOS.CLUB depuis votre écran d'accueil pour profiter de l'expérience complète.</p>
          </div>
        )}

        <div className="mt-8 space-y-6">

          {/* Android */}
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h2 className="font-bold text-emerald-900">{t("android_title")}</h2>
                <p className="text-[10px] text-emerald-600">{t("android_browsers")}</p>
              </div>
            </div>
            <div className="px-5 py-5">
              {installPrompt && !installed && (
                <div className="mb-4 rounded-xl bg-emerald-100 p-3 text-center">
                  <button
                    onClick={handleInstall}
                    className="cursor-pointer rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500"
                  >
                    📲 Installer en 1 clic
                  </button>
                  <p className="mt-1.5 text-[10px] text-emerald-600">Ou suivez les étapes ci-dessous</p>
                </div>
              )}
              <div className="space-y-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">{n}</div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{t(`a${n}`)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{t(`a${n}d`)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-700" dangerouslySetInnerHTML={{ __html: t("android_done") }} />
              </div>
            </div>
          </div>

          {/* iOS */}
          <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-5 py-3">
              <span className="text-2xl">🍎</span>
              <div>
                <h2 className="font-bold text-blue-900">{t("ios_title")}</h2>
                <p className="text-[10px] text-blue-600">{t("ios_browsers")}</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                <p className="text-xs text-amber-700" dangerouslySetInnerHTML={{ __html: t("ios_warning") }} />
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">{n}</div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{t(`i${n}`)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{t(`i${n}d`)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-700" dangerouslySetInnerHTML={{ __html: t("ios_why") }} />
              </div>
            </div>
          </div>

          {/* PC */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white">
            <div className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-5 py-3">
              <span className="text-2xl">💻</span>
              <div>
                <h2 className="font-bold text-neutral-800">{t("pc_title")}</h2>
                <p className="text-[10px] text-neutral-500">{t("pc_browsers")}</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-neutral-600" dangerouslySetInnerHTML={{ __html: t("pc_p1") }} />
              <p className="mt-3 text-xs text-neutral-400">{t("pc_p2")}</p>
            </div>
          </div>

          {/* Avantages */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5">
            <h3 className="font-bold text-emerald-900">{t("why_title")}</h3>
            <div className="mt-3 space-y-2">
              {t("why_items").split("|").map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-sm">{WHY_ICONS[i]}</span>
                  <p className="text-sm text-emerald-800">{item}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}