"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * DevicesList — Liste des appareils connectés aux push notifs
 * ═══════════════════════════════════════════════════════════════════
 *
 * S'affiche en dessous de <PushToggle /> dans Section 1 de
 * /espace/notifications.
 *
 * - Liste les push_subscriptions de l'user (1 par device).
 * - Marque le device courant avec une pastille verte ("Cet appareil").
 * - Affiche : icône plateforme, label lisible, navigateur (User-Agent),
 *   date dernière notif réussie, bouton "Déconnecter ce device".
 * - Le bouton DELETE appelle /api/notifications/subscribe avec
 *   { endpoint } (déjà supporté côté API V3.6 multi-device).
 *
 * Path : src/components/notifications/DevicesList.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from "react";

type Device = {
  id: string;
  endpoint: string;
  platform: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  consecutive_failures: number;
};

const PLATFORM_LABELS: Record<string, { label: string; icon: string }> = {
  android: { label: "Android", icon: "📱" },
  ios: { label: "iPhone / iPad", icon: "📱" },
  windows: { label: "Windows", icon: "🖥️" },
  firefox: { label: "Firefox", icon: "🦊" },
  other: { label: "Appareil", icon: "🌐" },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const days = Math.floor(hr / 24);

  if (sec < 60) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (hr < 24) return `il y a ${hr} h`;
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function extractBrowser(userAgent: string | null): string {
  if (!userAgent) return "";
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("chrome") && !ua.includes("edg/")) return "Chrome";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
  return "";
}

export default function DevicesList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Récupère l'endpoint du navigateur courant
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if ("serviceWorker" in navigator && "PushManager" in window) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (mounted) setCurrentEndpoint(sub?.endpoint || null);
        }
      } catch (e) {
        console.warn("[DevicesList] could not read current endpoint", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/devices");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDevices(Array.isArray(data.devices) ? data.devices : []);
    } catch (e) {
      console.error("[DevicesList] fetch failed", e);
      setDevices([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  async function handleDisconnect(device: Device) {
    if (!confirm(`Déconnecter cet appareil ?\n\n${PLATFORM_LABELS[device.platform]?.label || "Appareil"}\n\nIl ne recevra plus de notifications. Tu pourras toujours te reconnecter depuis ce device en réactivant les notifications.`)) {
      return;
    }
    setDeletingId(device.id);
    try {
      const res = await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: device.endpoint }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Si c'est le device courant, on doit aussi désabonner côté navigateur
      // (sinon le SW garde la sub et l'API la recréera au prochain getSubscription())
      if (device.endpoint === currentEndpoint) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
          setCurrentEndpoint(null);
        } catch (e) {
          console.warn("[DevicesList] browser unsubscribe failed", e);
        }
      }

      await fetchDevices();
    } catch (e) {
      console.error("[DevicesList] disconnect failed", e);
      alert("Impossible de déconnecter cet appareil. Réessaie dans un instant.");
    }
    setDeletingId(null);
  }

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        Chargement de tes appareils...
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-white/50 p-3 text-center text-xs text-neutral-500">
        Aucun appareil connecté. Active le push ci-dessus pour ajouter ce navigateur.
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
        Mes appareils connectés ({devices.length})
      </p>
      <div className="space-y-2">
        {devices.map((d) => {
          const platMeta = PLATFORM_LABELS[d.platform] || PLATFORM_LABELS.other;
          const isCurrent = d.endpoint === currentEndpoint;
          const browser = extractBrowser(d.user_agent);
          const inTrouble = d.consecutive_failures >= 3;

          return (
            <div
              key={d.id}
              className={`flex items-center justify-between gap-3 rounded-lg border bg-white p-3 ${
                isCurrent ? "border-emerald-300" : "border-neutral-200"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-lg">
                  {platMeta.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-neutral-800">
                      {platMeta.label}
                      {browser ? ` · ${browser}` : ""}
                    </p>
                    {isCurrent && (
                      <span className="flex-shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                        Cet appareil
                      </span>
                    )}
                    {inTrouble && (
                      <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                        Échecs récents
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {d.last_success_at
                      ? `Dernière notif reçue ${formatRelative(d.last_success_at)}`
                      : `Activé ${formatRelative(d.created_at)} · aucune notif encore reçue`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDisconnect(d)}
                disabled={deletingId === d.id}
                className="flex-shrink-0 cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {deletingId === d.id ? "..." : "Déconnecter"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}