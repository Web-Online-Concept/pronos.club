"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Pick, PickLeg, Sport, Bookmaker } from "@/lib/supabase/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  void: "bg-neutral-100 text-neutral-700",
  half_won: "bg-emerald-50 text-emerald-600",
  half_lost: "bg-red-50 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  won: "Gagné",
  lost: "Perdu",
  void: "Remboursé",
  half_won: "½ Gagné",
  half_lost: "½ Perdu",
};

interface PickWithLegs extends Pick {
  legs?: PickLeg[];
}

interface LegEdit {
  leg_number: number;
  event_name: string;
  selection: string;
  odds: string;
  competition: string;
  status: string;
  sport_id: string;
  eventDate: string;
  eventTime: string;
}

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = String(Math.floor(i / 12)).padStart(2, "0");
  const m = String((i % 12) * 5).padStart(2, "0");
  return `${h}:${m}`;
});

function dateToLocal(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeToLocal(iso: string) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const raw = d.getMinutes();
  const rounded = Math.round(raw / 5) * 5;
  const m = String(rounded >= 60 ? 0 : rounded).padStart(2, "0");
  return `${h}:${m}`;
}

function buildISODate(date: string, time: string): string {
  // Build as local time, then convert to ISO
  const d = new Date(`${date}T${time}:00`);
  return d.toISOString();
}

export default function PicksListPage() {
  const [picks, setPicks] = useState<PickWithLegs[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPick, setEditingPick] = useState<PickWithLegs | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form state — simple pick
  const [editEvent, setEditEvent] = useState("");
  const [editSelection, setEditSelection] = useState("");
  const [editOdds, setEditOdds] = useState("");
  const [editStake, setEditStake] = useState("");
  const [editCompetition, setEditCompetition] = useState("");
  const [editPremium, setEditPremium] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editSportId, setEditSportId] = useState("");
  const [editBookmakerId, setEditBookmakerId] = useState("");
  const [editMinOdds, setEditMinOdds] = useState("");
  const [editAnalysis, setEditAnalysis] = useState("");
  const [editBetUrl, setEditBetUrl] = useState("");
  const [editScreenshotUrl, setEditScreenshotUrl] = useState("");
  const [editScreenshotPreview, setEditScreenshotPreview] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [editEventTime, setEditEventTime] = useState("21:00");
  const [uploading, setUploading] = useState(false);

  // Edit form state — combined legs
  const [editLegs, setEditLegs] = useState<LegEdit[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);

  useEffect(() => {
    fetchPicks();
    fetch("/api/sports").then((r) => r.json()).then(setSports).catch(() => {});
    fetch("/api/bookmakers").then((r) => r.json()).then(setBookmakers).catch(() => {});
  }, []);

  async function fetchPicks() {
    setLoading(true);
    const res = await fetch("/api/picks?limit=100&include_legs=true");
    const { data } = await res.json();
    setPicks(data ?? []);
    setLoading(false);
  }

  function isCombi(pick: PickWithLegs) {
    return pick.pick_type === "combine" && (pick.legs?.length ?? 0) > 1;
  }

  function openEdit(pick: PickWithLegs) {
    setEditingPick(pick);
    setEditStake(String(pick.stake));
    setEditCompetition(pick.competition ?? "");
    setEditPremium(pick.is_premium);
    setEditStatus(pick.status);
    setEditSportId(pick.sport_id ?? "");
    setEditBookmakerId(pick.bookmaker_id ?? "");
    setEditMinOdds(pick.min_odds ? String(pick.min_odds) : "");
    setEditAnalysis(pick.analysis_fr ?? "");
    setEditBetUrl(pick.bet_url ?? "");
    setEditScreenshotUrl(pick.screenshot_url ?? "");
    setEditScreenshotPreview(pick.screenshot_url ?? "");
    setEditEventDate(dateToLocal(pick.event_date));
    setEditEventTime(timeToLocal(pick.event_date));

    if (isCombi(pick)) {
      const legs = (pick.legs ?? []).sort((a, b) => a.leg_number - b.leg_number);
      setEditLegs(
        legs.map((l) => ({
          leg_number: l.leg_number,
          event_name: l.event_name,
          selection: l.selection,
          odds: String(l.odds),
          competition: l.competition ?? "",
          status: l.status ?? "pending",
          sport_id: l.sport_id ?? pick.sport_id ?? "",
          eventDate: dateToLocal(l.event_date ?? pick.event_date),
          eventTime: timeToLocal(l.event_date ?? pick.event_date),
        }))
      );
      setEditOdds(String(pick.odds));
      setEditEvent(pick.event_name);
      setEditSelection(pick.selection);
    } else {
      setEditEvent(pick.event_name);
      setEditSelection(pick.selection);
      setEditOdds(String(pick.odds));
      setEditLegs([]);
    }
  }

  function updateLeg(legNumber: number, field: keyof LegEdit, value: string) {
    setEditLegs((prev) =>
      prev.map((l) => (l.leg_number === legNumber ? { ...l, [field]: value } : l))
    );
  }

  // Recalculate combined odds from legs
  function getCombinedOdds(): number {
    const product = editLegs.reduce((acc, l) => acc * (parseFloat(l.odds) || 1), 1);
    return Math.round(product * 100) / 100;
  }

  async function handleEditScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditScreenshotPreview(URL.createObjectURL(file));
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/picks/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.url) setEditScreenshotUrl(data.url);
    setUploading(false);
  }

  async function saveEdit() {
    if (!editingPick) return;
    setSaving(true);

    // Build event_date from date + time
    const eventDateISO = buildISODate(editEventDate, editEventTime);

    if (isCombi(editingPick)) {
      // Update each leg content via the legs API
      for (const leg of editLegs) {
        const legDateISO = buildISODate(leg.eventDate, leg.eventTime);
        await fetch("/api/picks/legs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pick_id: editingPick.id,
            leg_number: leg.leg_number,
            event_name: leg.event_name,
            selection: leg.selection,
            odds: parseFloat(leg.odds),
            competition: leg.competition,
            sport_id: leg.sport_id,
            event_date: legDateISO,
          }),
        });

        // Update each leg status via the result API
        await fetch(`/api/picks/${editingPick.id}/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leg_number: leg.leg_number,
            status: leg.status,
          }),
        });
      }

      // Use latest leg date for combined pick event_date (last match to finish)
      const legDates = editLegs.map((l) => {
        const d = new Date(`${l.eventDate}T${l.eventTime}:00`);
        return d;
      });
      const latestDate = new Date(Math.max(...legDates.map((d) => d.getTime()))).toISOString();
      console.log("[SAVE COMBI] leg dates:", editLegs.map((l) => `${l.eventDate} ${l.eventTime}`), "→ latestDate:", latestDate);

      const combinedOdds = getCombinedOdds();
      const combinedEventName = editLegs.map((l) => l.event_name).join(" + ");
      const combinedSelection = editLegs.map((l) => l.selection).join(" + ");

      await fetch("/api/picks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPick.id,
          event_name: combinedEventName,
          selection: combinedSelection,
          odds: combinedOdds,
          stake: parseFloat(editStake),
          competition: editLegs[0]?.competition ?? editCompetition,
          is_premium: editPremium,
          bookmaker_id: editBookmakerId,
          min_odds: editMinOdds ? parseFloat(editMinOdds) : null,
          analysis_fr: editAnalysis || null,
          screenshot_url: editScreenshotUrl || null,
          bet_url: editBetUrl || null,
          event_date: latestDate,
        }),
      });

      await fetchPicks();
      setEditingPick(null);
    } else {
      const res = await fetch("/api/picks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPick.id,
          event_name: editEvent,
          selection: editSelection,
          odds: parseFloat(editOdds),
          stake: parseFloat(editStake),
          competition: editCompetition,
          is_premium: editPremium,
          status: editStatus,
          sport_id: editSportId,
          bookmaker_id: editBookmakerId,
          min_odds: editMinOdds ? parseFloat(editMinOdds) : null,
          analysis_fr: editAnalysis || null,
          screenshot_url: editScreenshotUrl || null,
          bet_url: editBetUrl || null,
          event_date: eventDateISO,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setPicks((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        setEditingPick(null);
      }
    }

    setSaving(false);
  }

  async function voidPick(id: string) {
    const res = await fetch("/api/picks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "void" }),
    });

    if (res.ok) {
      const updated = await res.json();
      setPicks((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    }
  }

  const isResulted = (status: string) => status !== "pending";

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 [color-scheme:dark] [&>option]:bg-neutral-900 [&>option]:text-white [&>optgroup]:bg-neutral-900 [&>optgroup]:text-white";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(59,130,246,0.15)" }}>
            <span className="text-lg">📋</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Tous les picks</h1>
            <p className="text-xs text-white/30">{picks.length} pick{picks.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <Link
          href="/fr/admin/picks/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          + Nouveau
        </Link>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-white/30">Chargement...</p>
      ) : picks.length === 0 ? (
        <p className="mt-8 text-center text-sm text-white/30">Aucun pick publié</p>
      ) : (
        <div className="mt-6 space-y-3">
          {picks.map((pick) => {
            const combi = isCombi(pick);
            const legs = (pick.legs ?? []).sort((a, b) => a.leg_number - b.leg_number);

            return (
              <div key={pick.id} className="overflow-hidden rounded-xl border border-white/[0.06] p-4" style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-white">{pick.event_name}</p>
                      {combi && (
                        <span className="flex-shrink-0 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-400">
                          COMBINÉ
                        </span>
                      )}
                    </div>
                    {!combi && (
                      <p className="mt-0.5 text-sm text-white/40">{pick.selection}</p>
                    )}
                    {combi && legs.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {legs.map((leg) => (
                          <p key={leg.leg_number} className="text-xs text-white/30">
                            #{leg.leg_number} {leg.event_name} — {leg.selection} @{leg.odds}
                            {leg.status !== "pending" && (
                              <span className={`ml-1 font-semibold ${leg.status === "won" || leg.status === "half_won" ? "text-emerald-400" : leg.status === "lost" || leg.status === "half_lost" ? "text-red-400" : "text-neutral-400"}`}>
                                ({STATUS_LABELS[leg.status]})
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/20">
                      <span>{pick.sport?.icon} {pick.sport?.name_fr}</span>
                      {pick.competition && (
                        <>
                          <span>•</span>
                          <span>{pick.competition}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(pick.published_at).toLocaleDateString("fr-FR")}
                      </span>
                      {pick.is_premium && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-amber-400">Premium</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col items-end gap-1">
                    <span className="font-mono text-lg font-bold text-emerald-400">{pick.odds}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_COLORS[pick.status] ?? ""
                      }`}
                    >
                      {STATUS_LABELS[pick.status] ?? pick.status}
                    </span>
                    {pick.profit !== null && pick.profit !== 0 && (
                      <span
                        className={`text-xs font-bold ${
                          pick.profit > 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {pick.profit > 0 ? "+" : ""}{pick.profit}U
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
                  <button
                    onClick={() => openEdit(pick)}
                    className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 transition hover:bg-white/5 hover:text-white/80"
                  >
                    ✏️ Modifier
                  </button>

                  {pick.status !== "void" && (
                    <button
                      onClick={() => voidPick(pick.id)}
                      className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/50 transition hover:bg-white/5 hover:text-white/80"
                    >
                      ↩️ Void
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.06] p-6 shadow-xl" style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Modifier le pick</h2>
              {isCombi(editingPick) && (
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-400">
                  COMBINÉ
                </span>
              )}
            </div>

            {isResulted(editingPick.status) && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
                ⚠️ Ce pick a déjà un résultat ({STATUS_LABELS[editingPick.status]}). Toute modification recalculera le profit.
              </div>
            )}

            <div className="mt-4 space-y-3">
              {/* COMBINED — edit each leg */}
              {isCombi(editingPick) ? (
                <>
                  {editLegs.map((leg) => (
                    <div key={leg.leg_number} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                        Sélection {leg.leg_number}
                      </p>

                      <div className="space-y-2">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/30">Sport</label>
                          <select value={leg.sport_id} onChange={(e) => updateLeg(leg.leg_number, "sport_id", e.target.value)} className={inputClass}>
                            <option value="">Choisir un sport</option>
                            {sports.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name_fr}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/30">Événement</label>
                          <input type="text" value={leg.event_name} onChange={(e) => updateLeg(leg.leg_number, "event_name", e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/30">Sélection</label>
                          <input type="text" value={leg.selection} onChange={(e) => updateLeg(leg.leg_number, "selection", e.target.value)} className={inputClass} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/30">Date</label>
                            <input type="date" value={leg.eventDate} onChange={(e) => updateLeg(leg.leg_number, "eventDate", e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/30">Heure</label>
                            <select value={leg.eventTime} onChange={(e) => updateLeg(leg.leg_number, "eventTime", e.target.value)} className={inputClass}>
                              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/30">Cote</label>
                            <input type="number" step="0.01" value={leg.odds} onChange={(e) => updateLeg(leg.leg_number, "odds", e.target.value)} className={inputClass} />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/30">Compétition</label>
                            <input type="text" value={leg.competition} onChange={(e) => updateLeg(leg.leg_number, "competition", e.target.value)} className={inputClass} />
                          </div>
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-white/30">Résultat</label>
                          <select value={leg.status} onChange={(e) => updateLeg(leg.leg_number, "status", e.target.value)} className={inputClass}>
                            <option value="pending">⏳ En attente</option>
                            <option value="won">✅ Gagné</option>
                            <option value="lost">❌ Perdu</option>
                            <option value="void">↩️ Remboursé</option>
                            <option value="half_won">½ Gagné</option>
                            <option value="half_lost">½ Perdu</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Combined odds (auto-calculated) */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/30">Cote combinée</p>
                    <p className="mt-1 font-mono text-xl font-bold text-emerald-400">{getCombinedOdds()}</p>
                  </div>

                  {/* Stake */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Mise (U)</label>
                    <input type="number" step="0.5" value={editStake} onChange={(e) => setEditStake(e.target.value)} className={inputClass} />
                  </div>
                </>
              ) : (
                <>
                  {/* SIMPLE — all fields */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Sport</label>
                    <select value={editSportId} onChange={(e) => setEditSportId(e.target.value)} className={inputClass}>
                      <option value="">Choisir un sport</option>
                      {sports.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name_fr}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Événement</label>
                    <input type="text" value={editEvent} onChange={(e) => setEditEvent(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Sélection</label>
                    <input type="text" value={editSelection} onChange={(e) => setEditSelection(e.target.value)} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Date</label>
                      <input type="date" value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Heure</label>
                      <select value={editEventTime} onChange={(e) => setEditEventTime(e.target.value)} className={inputClass}>
                        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Cote</label>
                      <input type="number" step="0.01" value={editOdds} onChange={(e) => setEditOdds(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Mise (U)</label>
                      <input type="number" step="0.5" value={editStake} onChange={(e) => setEditStake(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Compétition</label>
                    <input type="text" value={editCompetition} onChange={(e) => setEditCompetition(e.target.value)} className={inputClass} />
                  </div>
                </>
              )}

              {/* === SHARED FIELDS (simple + combined) === */}

              {/* Cote minimum */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Cote minimum (optionnel)</label>
                <input type="number" step="0.01" value={editMinOdds} onChange={(e) => setEditMinOdds(e.target.value)} placeholder="Ex: 1.80" className={inputClass} />
              </div>

              {/* Bookmaker */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Bookmaker</label>
                <select value={editBookmakerId} onChange={(e) => setEditBookmakerId(e.target.value)} className={inputClass}>
                  <option value="">Choisir un bookmaker</option>
                  {bookmakers.filter((b) => b.active).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Screenshot */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Screenshot du ticket</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 p-4 transition hover:border-white/20" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <input type="file" accept="image/*" onChange={handleEditScreenshot} className="hidden" />
                  {editScreenshotPreview ? (
                    <img src={editScreenshotPreview} alt="Screenshot" className="max-h-32 rounded-lg" />
                  ) : uploading ? (
                    <span className="text-sm text-white/30">Upload en cours...</span>
                  ) : (
                    <span className="text-sm text-white/30">📷 Changer le screenshot</span>
                  )}
                </label>
              </div>

              {/* Bet URL */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Lien direct vers le pari (optionnel)</label>
                <input type="url" value={editBetUrl} onChange={(e) => setEditBetUrl(e.target.value)} placeholder="https://..." className={inputClass} />
              </div>

              {/* Analysis */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Analyse (optionnel)</label>
                <textarea value={editAnalysis} onChange={(e) => setEditAnalysis(e.target.value)} rows={3} className={inputClass} />
              </div>

              {/* Status — simple only */}
              {!isCombi(editingPick) && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/30">Statut</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={inputClass}>
                    <option value="pending">En attente</option>
                    <option value="won">Gagné</option>
                    <option value="lost">Perdu</option>
                    <option value="void">Remboursé</option>
                    <option value="half_won">½ Gagné</option>
                    <option value="half_lost">½ Perdu</option>
                  </select>
                </div>
              )}
              {isCombi(editingPick) && (
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-center text-xs text-purple-400">
                  Le statut du combiné est calculé automatiquement à partir des résultats de chaque sélection.
                </div>
              )}

              {/* Premium toggle */}
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                <span className="text-sm font-medium text-white/70">Premium</span>
                <button
                  type="button"
                  onClick={() => setEditPremium(!editPremium)}
                  className={`relative h-6 w-10 cursor-pointer rounded-full transition ${
                    editPremium ? "bg-emerald-500" : "bg-neutral-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                      editPremium ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 cursor-pointer rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button
                onClick={() => setEditingPick(null)}
                className="cursor-pointer rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-white/40 transition hover:bg-white/5"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}