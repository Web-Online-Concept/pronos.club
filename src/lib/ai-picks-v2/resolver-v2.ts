import { supabaseAdmin } from "@/lib/supabase/admin";
import { apiFootball } from "./apifootball-client";
import { computeProfit, type ResolutionStatus } from "./compute-profit";
import { resolvePickFromEspn, type EspnPick } from "./espn-resolver";
import type { Fixture } from "@/types/apifootball";

export type ResolveV2Report = {
  totalChecked: number;
  resolved: number;
  stillPending: number;
  failed: number;
  details: Array<{
    pickId: string;
    eventName: string;
    status: "won" | "lost" | "void" | "still_pending" | "error";
    source: string;
    note?: string;
    profit?: number;
  }>;
};

type AiPickV2Row = {
  id: string;
  pick_type: string;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string | null;
  apifootball_fixture_id: number | null;
  espn_event_id: string | null;
  status: string;
  odds: number | null;
  generation_version: string;
  /** v3 : odds_comparison contient combine_meta pour les combinés */
  odds_comparison: Record<string, unknown> | null;
};

const fetchPendingV2Picks = async (): Promise<AiPickV2Row[]> => {
  const { data, error } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, pick_type, sport, league, event_name, event_date, selection, market, apifootball_fixture_id, espn_event_id, status, odds, generation_version, odds_comparison"
    )
    // v5 (02/05/2026) : étend la résolution aux picks v3 (nouveau pipeline tipster IA)
    .in("generation_version", ["v2", "v3"])
    .eq("status", "pending")
    .is("deleted_at", null)
    .lt("event_date", new Date().toISOString())
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[ai-picks-resolve-v2] fetch error:", error);
    return [];
  }
  return (data ?? []) as AiPickV2Row[];
};

const isMatchFinished = (fixture: Fixture): boolean => {
  const finishedShorts = ["FT", "AET", "PEN", "AWD", "WO"];
  return finishedShorts.includes(fixture.fixture.status.short);
};

const resolveClassicPick1N2 = (
  fixture: Fixture,
  selection: string
): "won" | "lost" | "void" => {
  const homeGoals = fixture.goals.home;
  const awayGoals = fixture.goals.away;
  if (homeGoals === null || awayGoals === null) return "void";

  const homeName = fixture.teams.home.name.toLowerCase();
  const awayName = fixture.teams.away.name.toLowerCase();
  const sel = selection.toLowerCase().trim();

  if (sel.includes("nul") || sel === "draw" || sel === "n") {
    return homeGoals === awayGoals ? "won" : "lost";
  }

  const isOnHome =
    sel.includes(homeName) ||
    homeName.includes(sel) ||
    sel === "1" ||
    sel === "home";
  const isOnAway =
    sel.includes(awayName) ||
    awayName.includes(sel) ||
    sel === "2" ||
    sel === "away";

  if (isOnHome) return homeGoals > awayGoals ? "won" : "lost";
  if (isOnAway) return awayGoals > homeGoals ? "won" : "lost";

  return "void";
};

const resolveDoubleChance = (
  fixture: Fixture,
  selection: string
): "won" | "lost" | "void" => {
  const homeGoals = fixture.goals.home;
  const awayGoals = fixture.goals.away;
  if (homeGoals === null || awayGoals === null) return "void";

  const sel = selection.toLowerCase().replace(/\s+/g, "");

  if (sel.includes("1x")) {
    return homeGoals >= awayGoals ? "won" : "lost";
  }
  if (sel.includes("x2")) {
    return awayGoals >= homeGoals ? "won" : "lost";
  }
  if (sel.includes("12")) {
    return homeGoals !== awayGoals ? "won" : "lost";
  }
  return "void";
};

const resolveOverUnder = (
  fixture: Fixture,
  selection: string,
  threshold: number
): "won" | "lost" | "void" => {
  const homeGoals = fixture.goals.home;
  const awayGoals = fixture.goals.away;
  if (homeGoals === null || awayGoals === null) return "void";
  const total = homeGoals + awayGoals;
  const sel = selection.toLowerCase();
  const isOver = sel.includes("plus") || sel.includes("over");
  const isUnder = sel.includes("moins") || sel.includes("under");
  if (isOver) return total > threshold ? "won" : "lost";
  if (isUnder) return total < threshold ? "won" : "lost";
  return "void";
};

const resolveBtts = (
  fixture: Fixture,
  selection: string
): "won" | "lost" | "void" => {
  const homeGoals = fixture.goals.home;
  const awayGoals = fixture.goals.away;
  if (homeGoals === null || awayGoals === null) return "void";
  const both = homeGoals > 0 && awayGoals > 0;
  const sel = selection.toLowerCase();
  const isYes = sel.includes("oui") || sel.includes("yes");
  const isNo = sel.includes("non") || sel.includes("no");
  if (isYes) return both ? "won" : "lost";
  if (isNo) return !both ? "won" : "lost";
  return "void";
};

const resolveScorer = async (
  fixtureId: number,
  playerName: string
): Promise<"won" | "lost" | "void"> => {
  try {
    const events = await fetch(
      `https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`,
      {
        headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY ?? "" },
      }
    );
    if (!events.ok) return "void";
    const json = (await events.json()) as {
      response?: Array<{
        type?: string;
        detail?: string;
        player?: { name?: string };
      }>;
    };
    const goalEvents = (json.response ?? []).filter(
      (e) =>
        e.type === "Goal" &&
        e.detail !== "Missed Penalty" &&
        e.detail !== "Own Goal"
    );
    const scoredNames = goalEvents
      .map((e) => (e.player?.name ?? "").toLowerCase().trim())
      .filter(Boolean);

    const target = playerName.toLowerCase().trim();
    const targetParts = target.split(/\s+/);
    const lastName = targetParts[targetParts.length - 1] ?? "";

    const matched = scoredNames.some((n) => {
      if (n.includes(target) || target.includes(n)) return true;
      if (lastName && lastName.length > 3 && n.includes(lastName)) return true;
      return false;
    });

    return matched ? "won" : "lost";
  } catch (err) {
    console.warn(
      `[ai-picks-resolve-v2] scorer resolution failed for fixture ${fixtureId}:`,
      err instanceof Error ? err.message : err
    );
    return "void";
  }
};

const resolvePickFromApiFootball = async (
  pick: AiPickV2Row
): Promise<{ status: "won" | "lost" | "void" | "still_pending"; note?: string }> => {
  if (!pick.apifootball_fixture_id) {
    return { status: "still_pending", note: "No apifootball_fixture_id" };
  }

  const fixture = await apiFootball.getFixtureById(
    pick.apifootball_fixture_id,
    pick.id
  );

  if (!fixture) {
    return { status: "still_pending", note: "Fixture not found" };
  }

  if (!isMatchFinished(fixture)) {
    return {
      status: "still_pending",
      note: `Status: ${fixture.fixture.status.short}`,
    };
  }

  if (pick.pick_type === "scorer") {
    const result = await resolveScorer(
      pick.apifootball_fixture_id,
      pick.selection
    );
    return { status: result };
  }

  switch (pick.market) {
    case "1N2":
      return { status: resolveClassicPick1N2(fixture, pick.selection) };
    case "DOUBLE_CHANCE":
      return { status: resolveDoubleChance(fixture, pick.selection) };
    case "OVER_UNDER_1_5":
      return { status: resolveOverUnder(fixture, pick.selection, 1.5) };
    case "OVER_UNDER_2_5":
      return { status: resolveOverUnder(fixture, pick.selection, 2.5) };
    case "OVER_UNDER_3_5":
      return { status: resolveOverUnder(fixture, pick.selection, 3.5) };
    case "BTTS":
      return { status: resolveBtts(fixture, pick.selection) };
    default:
      return { status: "void", note: `Unknown market: ${pick.market}` };
  }
};

// ============================================================================
// v5 (02/05/2026) — RÉSOLUTION DES COMBINÉS v3
// ============================================================================

type CombineSelection = {
  match: string;
  selection: string;
  cote: number;
  book: string;
};

type CombineMeta = {
  selections: CombineSelection[];
  cote_totale_arjel: number | null;
  cote_totale_hors_arjel: number | null;
};

const extractCombineMeta = (pick: AiPickV2Row): CombineMeta | null => {
  if (!pick.odds_comparison || typeof pick.odds_comparison !== "object") {
    return null;
  }
  const oc = pick.odds_comparison as Record<string, unknown>;
  const cm = oc.combine_meta;
  if (!cm || typeof cm !== "object") return null;
  const meta = cm as Record<string, unknown>;
  if (!Array.isArray(meta.selections)) return null;
  return meta as unknown as CombineMeta;
};

/**
 * Résout une sélection individuelle d'un combiné via ESPN.
 */
const resolveSingleCombineSelection = async (
  selection: CombineSelection,
  parentPick: AiPickV2Row
): Promise<"won" | "lost" | "void" | "still_pending"> => {
  const espnPick: EspnPick = {
    id: `${parentPick.id}-sub`,
    pick_type: "classic",
    sport: parentPick.sport === "multi" ? "soccer" : parentPick.sport,
    league: parentPick.league,
    event_name: selection.match,
    event_date: parentPick.event_date,
    selection: selection.selection,
    market: "1N2",
    espn_event_id: null,
  };

  try {
    const result = await resolvePickFromEspn(espnPick);
    return result.status as "won" | "lost" | "void" | "still_pending";
  } catch (err) {
    console.warn(
      `[ai-picks-resolve-v2] combine sub-selection resolution failed for "${selection.match}":`,
      err instanceof Error ? err.message : err
    );
    return "still_pending";
  }
};

/**
 * Résout un combiné v3 en appliquant la logique ET sur ses sélections.
 * - Toutes won → won
 * - Au moins 1 lost → lost
 * - Au moins 1 still_pending → still_pending (retentera demain)
 * - Au moins 1 void → void
 */
const resolveCombinePick = async (
  pick: AiPickV2Row
): Promise<{ status: "won" | "lost" | "void" | "still_pending"; note?: string }> => {
  const meta = extractCombineMeta(pick);
  if (!meta || meta.selections.length === 0) {
    return { status: "still_pending", note: "Combine meta missing or empty" };
  }

  const subResults: string[] = [];
  for (const sel of meta.selections) {
    const r = await resolveSingleCombineSelection(sel, pick);
    subResults.push(r);
    // Optimisation : si une sélection est lost, le combiné est lost direct
    if (r === "lost") {
      return {
        status: "lost",
        note: `Sélection "${sel.match}" perdue (${subResults.length}/${meta.selections.length} résolues)`,
      };
    }
  }

  const allWon = subResults.every((r) => r === "won");
  if (allWon) {
    return {
      status: "won",
      note: `Combiné gagnant : ${meta.selections.length} sélections won`,
    };
  }

  if (subResults.some((r) => r === "still_pending")) {
    return {
      status: "still_pending",
      note: `Au moins une sélection encore pending`,
    };
  }

  if (subResults.some((r) => r === "void")) {
    return {
      status: "void",
      note: `Au moins une sélection void`,
    };
  }

  return { status: "still_pending", note: "Résolution combiné indéterminée" };
};

// ============================================================================
// UPDATE BDD
// ============================================================================

/**
 * v3 (avril 2026) : ajout du calcul automatique du profit en base lors de la
 * resolution. Logique partagee avec /api/admin/ai-picks/resolve via le helper
 * /lib/ai-picks-v2/compute-profit.ts.
 *
 * v4 (01/05/2026) : ajout du fallback ESPN pour les pronos non-foot.
 *                   resolution_source devient "cron_apifootball" ou "cron_espn"
 *                   selon la branche utilisee.
 *
 * v5 (02/05/2026) : ajout de la branche "cron_combine_v3" pour les combinés v3.
 */
const updatePickResolution = async (
  pickId: string,
  status: "won" | "lost" | "void",
  source: "cron_apifootball" | "cron_espn" | "cron_combine_v3",
  odds: number | null
): Promise<number> => {
  const profit = computeProfit(status as ResolutionStatus, odds);

  await supabaseAdmin
    .from("ai_picks")
    .update({
      status,
      profit,
      resolved_at: new Date().toISOString(),
      resolution_source: source,
    })
    .eq("id", pickId);

  return profit;
};

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

export const resolveV2Picks = async (): Promise<ResolveV2Report> => {
  const picks = await fetchPendingV2Picks();
  const report: ResolveV2Report = {
    totalChecked: picks.length,
    resolved: 0,
    stillPending: 0,
    failed: 0,
    details: [],
  };

  for (const pick of picks) {
    try {
      let resolution: { status: string; note?: string };
      let usedSource: "cron_apifootball" | "cron_espn" | "cron_combine_v3" = "cron_apifootball";

      // v5 (02/05/2026) : détection des combinés v3
      const isCombineV3 =
        pick.generation_version === "v3" && pick.market === "COMBINE";

      if (isCombineV3) {
        // BRANCHE 3 (v5) : combinés v3
        resolution = await resolveCombinePick(pick);
        usedSource = "cron_combine_v3";
      } else if (pick.apifootball_fixture_id) {
        // BRANCHE 1 : foot via API-Football (v2 + v3)
        resolution = await resolvePickFromApiFootball(pick);
        usedSource = "cron_apifootball";
      } else {
        // BRANCHE 2 (v4) : non-foot via ESPN scoreboard (v2 + v3)
        const espnPick: EspnPick = {
          id: pick.id,
          pick_type: pick.pick_type,
          sport: pick.sport,
          league: pick.league,
          event_name: pick.event_name,
          event_date: pick.event_date,
          selection: pick.selection,
          market: pick.market,
          espn_event_id: pick.espn_event_id,
        };
        resolution = await resolvePickFromEspn(espnPick);
        usedSource = "cron_espn";
      }

      if (
        resolution.status === "won" ||
        resolution.status === "lost" ||
        resolution.status === "void"
      ) {
        const profit = await updatePickResolution(
          pick.id,
          resolution.status,
          usedSource,
          pick.odds
        );
        report.resolved++;
        report.details.push({
          pickId: pick.id,
          eventName: pick.event_name,
          status: resolution.status,
          source: usedSource,
          note: resolution.note,
          profit,
        });
      } else {
        report.stillPending++;
        report.details.push({
          pickId: pick.id,
          eventName: pick.event_name,
          status: "still_pending",
          source: usedSource,
          note: resolution.note,
        });
      }
    } catch (err) {
      report.failed++;
      report.details.push({
        pickId: pick.id,
        eventName: pick.event_name,
        status: "error",
        source: pick.apifootball_fixture_id ? "cron_apifootball" : "cron_espn",
        note: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return report;
};