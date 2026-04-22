"use client";

import { useState, useEffect } from "react";

type Status = "idle" | "loading" | "subscribed" | "denied" | "unsupported" | "need-ios-install" | "error";

export default function PushToggle() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    // 1. Check unsupported browser
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }

    // 2. Detect iOS Safari without "Add to Home Screen"
    // iOS n'autorise les push QUE si la PWA est installée en mode standalone
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isIOS && !isStandalone) {
      setStatus("need-ios-install");
      return;
    }

    // 3. Check current permission state
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    // 4. Check current subscription state
    checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setStatus(subscription ? "subscribed" : "idle");
    } catch {
      setStatus("idle");
    }
  }

  async function subscribe() {
    setStatus("loading");
    setErrorMsg("");

    try {
      // Demander la permission si nécessaire
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          setStatus("denied");
          setErrorMsg("Permission refusée par le navigateur");
          return;
        }
      }

      // Enregistrer le Service Worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Nettoyer une éventuelle ancienne souscription côté client
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }

      // Créer nouvelle souscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      // Envoyer au serveur
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      setStatus("subscribed");
    } catch (err: unknown) {
      console.error("Push subscription failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  async function unsubscribe() {
    setStatus("loading");
    setErrorMsg("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      await fetch("/api/notifications/subscribe", { method: "DELETE" });
      setStatus("idle");
    } catch (err: unknown) {
      console.error("Push unsubscribe failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatus("error");
    }
  }

  // ─── Render ──────────────────────────────────────────────

  if (status === "unsupported") {
    return (
      <p className="text-xs opacity-40">
        Notifications push non supportées par ce navigateur
      </p>
    );
  }

  if (status === "need-ios-install") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="text-sm font-medium text-amber-300">📱 Installation requise sur iPhone</p>
        <p className="mt-1 text-xs opacity-70">
          Pour activer les notifications sur iPhone :
        </p>
        <ol className="mt-2 space-y-0.5 text-xs opacity-60">
          <li>1. Ouvrez ce site dans <strong>Safari</strong></li>
          <li>2. Touchez le bouton <strong>Partager</strong> (carré avec flèche)</li>
          <li>3. Choisissez <strong>Sur l&apos;écran d&apos;accueil</strong></li>
          <li>4. Ouvrez l&apos;appli depuis l&apos;écran d&apos;accueil</li>
          <li>5. Revenez ici pour activer les notifs</li>
        </ol>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
        <p className="text-sm font-medium text-red-300">🔕 Notifications bloquées</p>
        <p className="mt-1 text-xs opacity-60">
          Vous avez refusé les notifications. Autorisez-les dans les paramètres du navigateur puis rechargez la page.
        </p>
      </div>
    );
  }

  const isSubscribed = status === "subscribed";
  const isLoading = status === "loading";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Notifications push (PC ou App Mobile)</p>
          <p className="text-xs opacity-40">
            {isSubscribed ? "Activées" : "Désactivées"}
          </p>
        </div>
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          className={`relative h-7 w-12 cursor-pointer rounded-full transition disabled:opacity-50 ${
            isSubscribed ? "bg-emerald-500" : "bg-neutral-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              isSubscribed ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {status === "error" && errorMsg && (
        <p className="mt-2 text-xs text-red-400">Erreur: {errorMsg}</p>
      )}
    </div>
  );
}