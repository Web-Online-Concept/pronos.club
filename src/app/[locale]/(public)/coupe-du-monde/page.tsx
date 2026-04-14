// src/app/[locale]/(public)/coupe-du-monde/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";

// ── i18n ──
const TEXTS: Record<string, Record<string, string>> = {
  fr: {
    hero_tag: "COUPE DU MONDE FIFA 2026",
    hero_title: "Coupe du Monde 2026",
    hero_subtitle: "48 équipes · 12 groupes · 104 matchs · 11 juin — 19 juillet 2026 · USA, Canada, Mexique",
    tab_groups: "🏆 Groupes",
    tab_schedule: "📅 Calendrier",
    loading: "Chargement...",
    error: "Erreur de chargement. Réessayez.",
    no_data: "Aucune donnée disponible",
    no_matches: "Le calendrier ESPN sera disponible à l'approche du tournoi",
    group: "Groupe",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    all_groups: "Tous les groupes",
    all_phases: "Toutes les phases",
    group_stage: "Phase de groupes",
    knockout: "Phase éliminatoire",
    updated: "Groupes définitifs · Calendrier mis à jour via ESPN",
  },
  en: {
    hero_tag: "2026 FIFA WORLD CUP",
    hero_title: "2026 World Cup",
    hero_subtitle: "48 teams · 12 groups · 104 matches · June 11 — July 19, 2026 · USA, Canada, Mexico",
    tab_groups: "🏆 Groups",
    tab_schedule: "📅 Schedule",
    loading: "Loading...",
    error: "Failed to load. Try again.",
    no_data: "No data available",
    no_matches: "ESPN schedule will be available closer to the tournament",
    group: "Group",
    today: "Today",
    tomorrow: "Tomorrow",
    all_groups: "All groups",
    all_phases: "All phases",
    group_stage: "Group stage",
    knockout: "Knockout",
    updated: "Final groups · Schedule updated via ESPN",
  },
  es: {
    hero_tag: "COPA MUNDIAL FIFA 2026",
    hero_title: "Copa del Mundo 2026",
    hero_subtitle: "48 equipos · 12 grupos · 104 partidos · 11 junio — 19 julio 2026 · USA, Canadá, México",
    tab_groups: "🏆 Grupos",
    tab_schedule: "📅 Calendario",
    loading: "Cargando...",
    error: "Error al cargar. Inténtalo de nuevo.",
    no_data: "Sin datos disponibles",
    no_matches: "El calendario ESPN estará disponible cerca del torneo",
    group: "Grupo",
    today: "Hoy",
    tomorrow: "Mañana",
    all_groups: "Todos los grupos",
    all_phases: "Todas las fases",
    group_stage: "Fase de grupos",
    knockout: "Eliminatorias",
    updated: "Grupos definitivos · Calendario actualizado vía ESPN",
  },
};

// ── Main page ──
export default function WorldCupPage() {
  const locale = useLocale();
  const t = TEXTS[locale] || TEXTS.fr;
  const [activeView, setActiveView] = useState<"groups" | "schedule">("groups");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      setData(null);
      try {
        const res = await fetch(`/api/world-cup?view=${activeView}`);
        if (!res.ok) throw new Error("fail");
        const json = await res.json();
        setData(json);
      } catch {
        setError(true);
      }
      setLoading(false);
    }
    load();
  }, [activeView]);

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #1a0a2e 0%, #2d1050 30%, #0a2e1f 70%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">🏆 {t.hero_tag}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{t.hero_title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-white/40">{t.hero_subtitle}</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* View toggle */}
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setActiveView("groups")}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeView === "groups"
                ? "bg-neutral-900 text-white shadow"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            {t.tab_groups}
          </button>
          <button
            onClick={() => setActiveView("schedule")}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeView === "schedule"
                ? "bg-neutral-900 text-white shadow"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            {t.tab_schedule}
          </button>
        </div>

        {/* Content */}
        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-neutral-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <span className="text-sm">{t.loading}</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-red-500">{t.error}</p>
            </div>
          ) : activeView === "groups" ? (
            <GroupsView data={data} t={t} locale={locale} />
          ) : (
            <ScheduleView data={data} t={t} locale={locale} />
          )}
        </div>

        <p className="mt-6 pb-8 text-center text-[11px] text-neutral-400">{t.updated}</p>
      </div>
    </main>
  );
}

// ── Flag component ──
function Flag({ code, size = 24 }: { code: string; size?: number }) {
  if (!code) return null;
  // Subdivisions (gb-eng, gb-sct, gb-wls) only work as SVG on flagcdn
  const isSub = code.startsWith("gb-");
  const src = isSub
    ? `https://flagcdn.com/${code}.svg`
    : `https://flagcdn.com/48x36/${code}.png`;
  return (
    <img
      src={src}
      alt={code}
      width={size}
      height={Math.round(size * 0.75)}
      className="inline-block rounded-sm object-cover"
      loading="lazy"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ── Groups View ──
function GroupsView({ data, t, locale }: { data: any; t: Record<string, string>; locale: string }) {
  const groups = data?.groups || [];
  if (groups.length === 0) return <p className="text-center text-neutral-400 py-10">{t.no_data}</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group: any) => (
        <div key={group.name} className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="bg-neutral-900 px-4 py-2.5">
            <h3 className="text-sm font-bold text-white">{t.group} {group.name}</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {group.teams.map((team: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Flag code={team.flag} size={22} />
                <span className="text-sm font-semibold text-neutral-900">
                  {locale === "en" || locale === "es" ? team.nameEn : team.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Schedule helpers ──
function groupMatchesByDate(matches: any[], locale: string, t: Record<string, string>) {
  const groups: { label: string; matches: any[] }[] = [];
  const map = new Map<string, any[]>();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const tom = new Date(now.getTime() + 86400000);
  const tomorrowStr = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, "0")}-${String(tom.getDate()).padStart(2, "0")}`;

  for (const m of matches) {
    const d = new Date(m.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let label = dateStr;
    if (dateStr === todayStr) label = t.today;
    else if (dateStr === tomorrowStr) label = t.tomorrow;
    else {
      label = d.toLocaleDateString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", {
        weekday: "short", day: "numeric", month: "short",
      });
    }
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(m);
  }
  for (const [label, matches] of map) {
    groups.push({ label, matches });
  }
  return groups;
}

function formatMatchTime(dateStr: string, locale: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-US", {
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Schedule View ──
function ScheduleView({ data, t, locale }: { data: any; t: Record<string, string>; locale: string }) {
  const matches = data?.matches || [];

  if (matches.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🏟️</p>
        <p className="text-neutral-500 text-sm">{t.no_matches}</p>
        <p className="text-neutral-400 text-xs mt-1">11 juin — 19 juillet 2026</p>
      </div>
    );
  }

  const grouped = groupMatchesByDate(matches, locale, t);

  return (
    <div className="space-y-6">
      {grouped.map((group, gi) => (
        <div key={gi}>
          <h3 className="mb-3 text-sm font-bold text-neutral-900 uppercase tracking-wide">{group.label}</h3>
          <div className="space-y-2">
            {group.matches.map((match: any, mi: number) => (
              <div
                key={match.id ?? mi}
                className="overflow-hidden rounded-xl border border-neutral-200 bg-white px-3 py-3 sm:px-4 transition hover:border-neutral-300"
              >
                <div className="flex items-center gap-2 sm:gap-4">
                  {/* Home */}
                  <div className="flex-1 flex items-center justify-end gap-2 text-right min-w-0">
                    <span className="text-xs font-semibold text-neutral-900 truncate">{match.home?.name}</span>
                    {match.home?.logo && <img src={match.home.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                  </div>

                  {/* Score or Time */}
                  <div className="flex flex-col items-center shrink-0 min-w-[56px]">
                    {match.completed ? (
                      <span className="text-sm font-extrabold text-neutral-900">{match.home?.score} - {match.away?.score}</span>
                    ) : (
                      <span className="text-sm font-bold text-emerald-600">{formatMatchTime(match.date, locale)}</span>
                    )}
                    {match.venue && (
                      <span className="text-[9px] text-neutral-400 mt-0.5 hidden sm:block truncate max-w-[140px] text-center">
                        {match.city || match.venue}
                      </span>
                    )}
                  </div>

                  {/* Away */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {match.away?.logo && <img src={match.away.logo} alt="" className="h-6 w-6 object-contain shrink-0" />}
                    <span className="text-xs font-semibold text-neutral-900 truncate">{match.away?.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}