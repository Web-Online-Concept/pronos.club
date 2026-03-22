"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PickCard from "@/components/picks/PickCard";
import type { Sport, Bookmaker, Pick as PickType, PickLeg } from "@/lib/supabase/types";

interface LegState {
  sportId: string;
  competition: string;
  eventName: string;
  selection: string;
  odds: string;
  eventDate: string;
  eventTime: string;
}

const today = new Date().toISOString().slice(0, 10);
const EMPTY_LEG: LegState = { sportId: "", competition: "", eventName: "", selection: "", odds: "", eventDate: today, eventTime: "21:00" };

const INPUT_CLASS = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 [color-scheme:dark] [&>option]:bg-neutral-900 [&>option]:text-white [&>optgroup]:bg-neutral-900 [&>optgroup]:text-white";
const LABEL_CLASS = "block text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5";

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = String(Math.floor(i / 12)).padStart(2, "0");
  const m = String((i % 12) * 5).padStart(2, "0");
  return `${h}:${m}`;
});

function LegForm({ leg, setLeg, label, sports }: { leg: LegState; setLeg: (l: LegState) => void; label: string; sports: Sport[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] p-4" style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-400">{label}</p>
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS}>Sport</label>
          <select value={leg.sportId} onChange={(e) => setLeg({ ...leg, sportId: e.target.value })} required className={INPUT_CLASS}>
            <option value="">Choisir un sport</option>
            {sports.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name_fr}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Compétition (optionnel)</label>
          <input type="text" value={leg.competition} onChange={(e) => setLeg({ ...leg, competition: e.target.value })} placeholder="Ligue 1, Champions League, NBA..." className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Événement</label>
          <input type="text" value={leg.eventName} onChange={(e) => setLeg({ ...leg, eventName: e.target.value })} placeholder="PSG vs Milan" required className={INPUT_CLASS} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Date</label>
            <input type="date" value={leg.eventDate} onChange={(e) => setLeg({ ...leg, eventDate: e.target.value })} required className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Heure</label>
            <select value={leg.eventTime} onChange={(e) => setLeg({ ...leg, eventTime: e.target.value })} required className={INPUT_CLASS}>
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS}>Sélection</label>
          <input type="text" value={leg.selection} onChange={(e) => setLeg({ ...leg, selection: e.target.value })} placeholder="Victoire PSG" required className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Cote</label>
          <input type="number" step="0.01" min="1.01" value={leg.odds} onChange={(e) => setLeg({ ...leg, odds: e.target.value })} placeholder="1.85" required className={INPUT_CLASS} inputMode="decimal" />
        </div>
      </div>
    </div>
  );
}

export default function NewPickPage() {
  const router = useRouter();

  const [sports, setSports] = useState<Sport[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Pick type
  const [pickType, setPickType] = useState<"simple" | "combine">("simple");

  // Shared fields
  const [bookmakerId, setBookmakerId] = useState("");
  const [stake, setStake] = useState("1");
  const [minOdds, setMinOdds] = useState("");
  const [isPremium, setIsPremium] = useState(true);
  const [analysisFr, setAnalysisFr] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [betUrl, setBetUrl] = useState("");
  const [notifResult, setNotifResult] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Legs
  const [leg1, setLeg1] = useState<LegState>({ ...EMPTY_LEG });
  const [leg2, setLeg2] = useState<LegState>({ ...EMPTY_LEG });

  useEffect(() => {
    const savedSport = localStorage.getItem("pc_last_sport");
    const savedBookmaker = localStorage.getItem("pc_last_bookmaker");
    if (savedSport) setLeg1((l) => ({ ...l, sportId: savedSport }));
    if (savedBookmaker) setBookmakerId(savedBookmaker);

    const now = new Date();
  }, []);

  const SPORT_ORDER = ["football", "tennis", "basketball", "rugby"];

  useEffect(() => {
    fetch("/api/sports")
      .then((r) => r.json())
      .then((data: Sport[]) => {
        const sorted = [...data].sort((a, b) => {
          const iA = SPORT_ORDER.indexOf(a.slug);
          const iB = SPORT_ORDER.indexOf(b.slug);
          if (iA !== -1 && iB !== -1) return iA - iB;
          if (iA !== -1) return -1;
          if (iB !== -1) return 1;
          return a.name_fr.localeCompare(b.name_fr);
        });
        setSports(sorted);
      });
    fetch("/api/bookmakers").then((r) => r.json()).then(setBookmakers);
  }, []);

  useEffect(() => {
    if (leg1.sportId) localStorage.setItem("pc_last_sport", leg1.sportId);
  }, [leg1.sportId]);

  useEffect(() => {
    if (bookmakerId) localStorage.setItem("pc_last_bookmaker", bookmakerId);
  }, [bookmakerId]);

  // Computed combined odds
  const leg1Odds = parseFloat(leg1.odds) || 0;
  const leg2Odds = parseFloat(leg2.odds) || 0;
  const combinedOdds = pickType === "combine" && leg1Odds > 0 && leg2Odds > 0
    ? Math.round(leg1Odds * leg2Odds * 100) / 100
    : 0;

  function buildPreviewPick(): PickType {
    const selectedSport = sports.find((s) => s.id === leg1.sportId) ?? null;
    const selectedBook = bookmakers.find((b) => b.id === bookmakerId) ?? null;
    const finalOdds = pickType === "simple" ? parseFloat(leg1.odds) || 0 : combinedOdds;
    const finalEventName = pickType === "simple"
      ? leg1.eventName
      : `${leg1.eventName} + ${leg2.eventName}`;
    const finalSelection = pickType === "simple"
      ? leg1.selection
      : `${leg1.selection} + ${leg2.selection}`;
    const leg1Date = new Date(`${leg1.eventDate}T${leg1.eventTime}`);

    const previewLegs: PickLeg[] = [];
    if (pickType === "simple") {
      previewLegs.push({
        id: "preview-1",
        pick_id: "preview",
        leg_number: 1,
        event_name: leg1.eventName,
        selection: leg1.selection,
        sport_id: leg1.sportId,
        competition: leg1.competition || null,
        odds: parseFloat(leg1.odds) || 0,
        status: "pending",
        sport: selectedSport ?? undefined,
      } as PickLeg);
    } else {
      const sport2 = sports.find((s) => s.id === leg2.sportId) ?? selectedSport;
      previewLegs.push(
        {
          id: "preview-1",
          pick_id: "preview",
          leg_number: 1,
          event_name: leg1.eventName,
          selection: leg1.selection,
          sport_id: leg1.sportId,
          competition: leg1.competition || null,
          odds: parseFloat(leg1.odds) || 0,
          status: "pending",
          sport: selectedSport ?? undefined,
        } as PickLeg,
        {
          id: "preview-2",
          pick_id: "preview",
          leg_number: 2,
          event_name: leg2.eventName,
          selection: leg2.selection,
          sport_id: leg2.sportId,
          competition: leg2.competition || null,
          odds: parseFloat(leg2.odds) || 0,
          status: "pending",
          sport: sport2 ?? undefined,
        } as PickLeg
      );
    }

    return {
      id: "preview",
      pick_type: pickType,
      sport_id: leg1.sportId,
      competition: leg1.competition || null,
      bookmaker_id: bookmakerId,
      event_name: finalEventName,
      event_date: leg1Date.toISOString(),
      selection: finalSelection,
      odds: finalOdds,
      min_odds: minOdds ? parseFloat(minOdds) : null,
      stake: parseFloat(stake) || 1,
      is_premium: isPremium,
      analysis_fr: analysisFr || null,
      analysis_en: null,
      analysis_es: null,
      screenshot_url: screenshotUrl || null,
      status: "pending",
      profit: null,
      result_entered_at: null,
      published_at: new Date().toISOString(),
      notify_sent: false,
      pick_number: 0,
      bet_url: betUrl || null,
      sport: selectedSport ?? undefined,
      bookmaker: selectedBook ?? undefined,
      legs: previewLegs,
    } as PickType;
  }

  async function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScreenshotPreview(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/picks/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (data.url) {
      setScreenshotUrl(data.url);
    }

    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNotifResult("");

    const finalOdds = pickType === "simple" ? parseFloat(leg1.odds) : combinedOdds;
    const finalEventName = pickType === "simple"
      ? leg1.eventName
      : `${leg1.eventName} + ${leg2.eventName}`;
    const finalSelection = pickType === "simple"
      ? leg1.selection
      : `${leg1.selection} + ${leg2.selection}`;

    // Use leg1 date for simple, earliest date for combined
    const leg1Date = new Date(`${leg1.eventDate}T${leg1.eventTime}`);
    const leg2Date = new Date(`${leg2.eventDate}T${leg2.eventTime}`);
    const eventDate = pickType === "simple" ? leg1Date : (leg1Date > leg2Date ? leg1Date : leg2Date);

    // 1. Create the pick
    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pick_type: pickType,
        sport_id: leg1.sportId,
        competition: leg1.competition || null,
        bookmaker_id: bookmakerId,
        event_name: finalEventName,
        event_date: eventDate.toISOString(),
        selection: finalSelection,
        odds: finalOdds,
        min_odds: minOdds ? parseFloat(minOdds) : null,
        stake: parseFloat(stake),
        is_premium: isPremium,
        analysis_fr: analysisFr || null,
        screenshot_url: screenshotUrl || null,
        bet_url: betUrl || null,
      }),
    });

    if (!res.ok) {
      setLoading(false);
      return;
    }

    const pick = await res.json();

    // 2. Create legs
    const legs = [
      {
        pick_id: pick.id,
        leg_number: 1,
        event_name: leg1.eventName,
        selection: leg1.selection,
        sport_id: leg1.sportId,
        competition: leg1.competition || null,
        odds: parseFloat(leg1.odds),
        event_date: new Date(`${leg1.eventDate}T${leg1.eventTime}:00`).toISOString(),
      },
    ];

    if (pickType === "combine") {
      legs.push({
        pick_id: pick.id,
        leg_number: 2,
        event_name: leg2.eventName,
        selection: leg2.selection,
        sport_id: leg2.sportId,
        competition: leg2.competition || null,
        odds: parseFloat(leg2.odds),
        event_date: new Date(`${leg2.eventDate}T${leg2.eventTime}:00`).toISOString(),
      });
    }

    const legsRes = await fetch("/api/picks/legs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legs }),
    });

    if (!legsRes.ok) {
      const err = await legsRes.json().catch(() => ({}));
      setNotifResult(`❌ Erreur création des sélections : ${err.error ?? "Erreur inconnue"}. Le pick a été créé mais les legs sont manquantes. Corrigez dans "Tous les picks".`);
      setLoading(false);
      return;
    }

    // 3. Send notifications (only if legs created successfully)
    const selectedSport = sports.find((s) => s.id === leg1.sportId);
    const sportLabel = selectedSport ? `${selectedSport.icon} ${selectedSport.name_fr}` : "";

    fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: pickType === "combine"
          ? `🎯 Nouveau combiné : ${finalEventName}`
          : `🎯 Nouveau pick : ${finalEventName}`,
        body: `${finalSelection} @ ${finalOdds} (${stake}U)`,
        url: "/fr/pronostics",
        pickId: pick.id,
        sport: sportLabel,
        isPremium,
      }),
    }).then(async (notifRes) => {
      if (notifRes.ok) {
        const result = await notifRes.json();
        setNotifResult(
          `✅ Notifications envoyées — Push: ${result.pushSent}, Email: ${result.emailSent}, Telegram: ${result.telegramSent ? "✓" : "✗"}`
        );
      }
    }).catch(() => {});

    setNotifResult("✅ Pick publié ! Envoi des notifications en cours...");
    setLoading(false);

    setTimeout(() => {
      router.push("/fr/admin");
    }, 3000);
  }



  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(16,185,129,0.15)" }}>
          <span className="text-lg">🎯</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Nouveau pick</h1>
          <p className="text-xs text-white/30">Créer et publier un pronostic</p>
        </div>
      </div>

      {notifResult && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          {notifResult}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">

        {/* Pick type toggle */}
        <div className="flex rounded-xl border border-white/10 p-1" style={{ background: "rgba(255,255,255,0.03)" }}>
          <button
            type="button"
            onClick={() => setPickType("simple")}
            className={`flex-1 cursor-pointer rounded-lg py-2.5 text-sm font-bold transition ${
              pickType === "simple"
                ? "bg-emerald-600 text-white"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setPickType("combine")}
            className={`flex-1 cursor-pointer rounded-lg py-2.5 text-sm font-bold transition ${
              pickType === "combine"
                ? "bg-emerald-600 text-white"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            Combiné (2 sélections)
          </button>
        </div>

        {/* Leg 1 */}
        <LegForm sports={sports}
          leg={leg1}
          setLeg={setLeg1}
          label={pickType === "combine" ? "Sélection 1" : "Pronostic"}
        />

        {/* Leg 2 (combine only) */}
        {pickType === "combine" && (
          <LegForm sports={sports}
            leg={leg2}
            setLeg={setLeg2}
            label="Sélection 2"
          />
        )}

        {/* Combined odds display */}
        {pickType === "combine" && combinedOdds > 0 && (
          <div className="overflow-hidden rounded-xl border border-white/[0.06] p-4 text-center" style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Cote combinée</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-400">{combinedOdds}</p>
            <p className="mt-0.5 text-xs text-white/30">{leg1.odds} × {leg2.odds}</p>
          </div>
        )}

        {/* Min odds */}
        <div>
          <label className={LABEL_CLASS}>Cote minimum (optionnel)</label>
          <input
            type="number"
            step="0.01"
            min="1.01"
            value={minOdds}
            onChange={(e) => setMinOdds(e.target.value)}
            placeholder="Ex: 1.80 — ne pas jouer en dessous"
            className={INPUT_CLASS}
            inputMode="decimal"
          />
        </div>

        {/* Stake */}
        <div>
          <label className={LABEL_CLASS}>Mise</label>
          <div className="flex gap-2">
            {["0.5", "1", "2", "3"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setStake(v)}
                className={`flex-1 cursor-pointer rounded-xl py-3 text-sm font-bold transition ${
                  stake === v
                    ? "bg-emerald-600 text-white"
                    : "border border-white/10 text-white/30 hover:border-white/20"
                }`}
              >
                {v}U
              </button>
            ))}
          </div>
        </div>

        {/* Bookmaker */}
        <div>
          <label className={LABEL_CLASS}>Bookmaker</label>
          <select
            value={bookmakerId}
            onChange={(e) => setBookmakerId(e.target.value)}
            required
            className={INPUT_CLASS}
          >
            <option value="">Choisir un bookmaker</option>
            {bookmakers.filter((b) => b.category === "hors_arjel").length > 0 && (
              <optgroup label="Hors Arjel">
                {bookmakers.filter((b) => b.category === "hors_arjel").map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
            )}
            {bookmakers.filter((b) => b.category === "arjel").length > 0 && (
              <optgroup label="Arjel">
                {bookmakers.filter((b) => b.category === "arjel").map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
            )}
            {bookmakers.filter((b) => !b.category || (b.category !== "hors_arjel" && b.category !== "arjel")).length > 0 && (
              <optgroup label="Autres">
                {bookmakers.filter((b) => !b.category || (b.category !== "hors_arjel" && b.category !== "arjel")).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Screenshot */}
        <div>
          <label className={LABEL_CLASS}>Screenshot du ticket</label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 p-6 transition hover:border-white/20" style={{ background: "rgba(255,255,255,0.02)" }}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleScreenshot}
              className="hidden"
            />
            {screenshotPreview ? (
              <img
                src={screenshotPreview}
                alt="Screenshot"
                className="max-h-40 rounded-lg"
              />
            ) : uploading ? (
              <span className="text-sm text-white/30">Upload en cours...</span>
            ) : (
              <span className="text-sm text-white/30">
                📷 Prendre une photo ou choisir un fichier
              </span>
            )}
          </label>
        </div>

        {/* Bet URL */}
        <div>
          <label className={LABEL_CLASS}>Lien direct vers le pari (optionnel)</label>
          <input
            type="url"
            value={betUrl}
            onChange={(e) => setBetUrl(e.target.value)}
            placeholder="https://stake.com/sports/..."
            className={INPUT_CLASS}
          />
        </div>

        {/* Premium toggle */}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div>
            <span className="text-sm font-medium text-white/70">Offrir en gratuit</span>
            <p className="text-xs text-white/25">Par défaut, les pronos sont réservés aux Premium</p>
          </div>
          <button
            type="button"
            onClick={() => setIsPremium(!isPremium)}
            className={`relative h-7 w-12 rounded-full transition ${
              !isPremium ? "bg-emerald-500" : "bg-neutral-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                !isPremium ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Analysis */}
        <div>
          <label className={LABEL_CLASS}>Analyse (optionnel)</label>
          <textarea
            value={analysisFr}
            onChange={(e) => setAnalysisFr(e.target.value)}
            placeholder="Votre analyse du match..."
            rows={3}
            className={INPUT_CLASS}
          />
        </div>

        {/* Preview button */}
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="w-full cursor-pointer rounded-xl border-2 border-emerald-600 py-4 text-base font-bold text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
        >
          👁 Prévisualiser le ticket
        </button>

        <button
          type="submit"
          disabled={loading || uploading}
          className="w-full cursor-pointer rounded-xl bg-emerald-600 py-4 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Publication + envoi des notifications..." : pickType === "combine" ? "🎯 Publier le combiné + Notifier" : "🎯 Publier + Notifier"}
        </button>
      </form>

      {/* Preview modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Prévisualisation</p>
              <p className="mt-1 text-sm text-white/30">Voici comment le ticket apparaîtra sur le site</p>
            </div>

            <PickCard pick={buildPreviewPick()} />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 cursor-pointer rounded-xl border border-white/20 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                ← Revenir au formulaire
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  // Trigger submit programmatically
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }}
                disabled={loading || uploading}
                className="flex-1 cursor-pointer rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                🎯 Publier + Notifier
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}