"use client";

import { useState, useEffect } from "react";

export default function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      checkSubscription();
    }
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setSubscribed(!!subscription);
    } catch {
      // Silent
    }
  }

  async function subscribe() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
      });

      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
    setLoading(false);
  }

  if (!supported) {
    return (
      <p className="text-xs opacity-40">
        Notifications push non supportées par votre navigateur
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Notifications push (PC ou App Mobile)</p>
        <p className="text-xs opacity-40">
          {subscribed ? "Activées" : "Désactivées"}
        </p>
      </div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className={`relative h-7 w-12 rounded-full transition ${
          subscribed ? "bg-emerald-500" : "bg-neutral-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            subscribed ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}