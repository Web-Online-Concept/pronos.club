// src/app/api/admin/tipster-concours/route.ts
//
// Admin : preview du classement + clôture manuelle + gestion paiements
//
// LOT 21 (11/05/2026) — REFONTE :
//   - Fix critique : filtre sur match_date (PAS resolved_at) avec timezone Paris
//   - Garde-fou : ne peut clôturer si des picks de la période sont encore pending
//   - Preview : action "preview" retourne le classement actuel pour validation visuelle
//   - Closure : action "close" insère le winner + envoie email + trace l'admin
//   - Support période passée explicite (period_start optionnel)
//   - Email via Brevo (lib/emails.ts) au lieu de Resend

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getConcoursConfig } from "@/lib/tipster-concours-config";
import { sendConcoursWeekWinnerEmail, sendConcoursMonthWinnerEmail } from "@/lib/emails";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// AUTH
// ============================================================================

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return null;
  return profile;
}

// ============================================================================
// HELPERS TIMEZONE PARIS
// ============================================================================

function getParisOffsetMs(utcDate: Date): number {
  const parisTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utcTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "UTC" }));
  return parisTime.getTime() - utcTime.getTime();
}

function parisMidnightUTC(year: number, month: number, day: number): Date {
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12));
  const parisOffsetMs = getParisOffsetMs(noonUTC);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(utcMidnight.getTime() - parisOffsetMs);
}

function getParisTodayParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return {
    year: parseInt(parts.find(p => p.type === "year")!.value),
    month: parseInt(parts.find(p => p.type === "month")!.value),
    day: parseInt(parts.find(p => p.type === "day")!.value),
  };
}

/**
 * Calcule les bornes d'une période semaine OU mois.
 * @param periodType "week" | "month"
 * @param scope "current" (en cours) | "previous" (la précédente) | string YYYY-MM-DD (période passée précise)
 */
function getPeriodBounds(
  periodType: "week" | "month",
  scope: "current" | "previous" | string
): { start: Date; end: Date; startDate: string; endDate: string } {
  let startYear: number, startMonth: number, startDay: number;

  if (scope === "current" || scope === "previous") {
    const { year, month, day } = getParisTodayParts();

    if (periodType === "week") {
      // Trouver le lundi de la semaine en cours
      const currentDate = new Date(year, month - 1, day);
      const dow = currentDate.getDay();
      const daysBack = dow === 0 ? 6 : dow - 1;
      const monday = new Date(year, month - 1, day - daysBack);

      // Si "previous", on recule de 7 jours
      const offset = scope === "previous" ? -7 : 0;
      monday.setDate(monday.getDate() + offset);

      startYear = monday.getFullYear();
      startMonth = monday.getMonth() + 1;
      startDay = monday.getDate();
    } else {
      // month
      const offsetMonths = scope === "previous" ? -1 : 0;
      const targetMonth = month + offsetMonths;
      const refDate = new Date(year, targetMonth - 1, 1);
      startYear = refDate.getFullYear();
      startMonth = refDate.getMonth() + 1;
      startDay = 1;
    }
  } else {
    // scope est une date YYYY-MM-DD (lundi pour week, 1er du mois pour month)
    const parts = scope.split("-");
    startYear = parseInt(parts[0]);
    startMonth = parseInt(parts[1]);
    startDay = parseInt(parts[2]);
  }

  const start = parisMidnightUTC(startYear, startMonth, startDay);

  let end: Date;
  if (periodType === "week") {
    // Dimanche 23:59:59.999 Paris = lundi suivant minuit Paris - 1ms
    const nextMonday = new Date(startYear, startMonth - 1, startDay + 7);
    end = new Date(parisMidnightUTC(nextMonday.getFullYear(), nextMonday.getMonth() + 1, nextMonday.getDate()).getTime() - 1);
  } else {
    // Dernier jour du mois 23:59:59.999 Paris
    const nextMonth1 = startMonth === 12 ? 1 : startMonth + 1;
    const nextMonthY = startMonth === 12 ? startYear + 1 : startYear;
    end = new Date(parisMidnightUTC(nextMonthY, nextMonth1, 1).getTime() - 1);
  }

  // Format YYYY-MM-DD pour la BDD
  const pad = (n: number) => String(n).padStart(2, "0");
  const startDate = `${startYear}-${pad(startMonth)}-${pad(startDay)}`;

  const endParisParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(end);
  const endDate = endParisParts.find(p => p.type === "year")!.value + "-" +
                  endParisParts.find(p => p.type === "month")!.value + "-" +
                  endParisParts.find(p => p.type === "day")!.value;

  return { start, end, startDate, endDate };
}

// ============================================================================
// CALCUL DU CLASSEMENT
// ============================================================================

type Ranking = {
  user_id: string;
  pseudo: string;
  avatar_url: string | null;
  email: string | null;
  paypal_email: string | null;
  total_picks: number;
  total_units: number;
  pending_picks: number; // Pour info admin
};

async function computeRanking(
  start: Date,
  end: Date,
  minPicks: number
): Promise<{ ranking: Ranking[]; non_eligible: Ranking[]; pending_total: number }> {
  // 1. Picks RÉSOLUS sur la période (filtre sur match_date, pas resolved_at)
  const { data: resolvedPicks } = await supabaseAdmin
    .from("tipster_picks")
    .select(`
      user_id,
      units_result,
      users:user_id (id, pseudo, avatar_url, email, paypal_email)
    `)
    .eq("status", "resolved")
    .gte("match_date", start.toISOString())
    .lte("match_date", end.toISOString());

  // 2. Picks PENDING sur la période (pour warning admin)
  const { data: pendingPicks } = await supabaseAdmin
    .from("tipster_picks")
    .select("user_id")
    .eq("status", "pending")
    .gte("match_date", start.toISOString())
    .lte("match_date", end.toISOString());

  // Agrégation
  const map = new Map<string, Ranking>();

  for (const p of resolvedPicks || []) {
    const user = (p as any).users;
    if (!user) continue;
    if (!map.has(p.user_id)) {
      map.set(p.user_id, {
        user_id: p.user_id,
        pseudo: user.pseudo || "TIPSTER",
        avatar_url: user.avatar_url || null,
        email: user.email || null,
        paypal_email: user.paypal_email || null,
        total_picks: 0,
        total_units: 0,
        pending_picks: 0,
      });
    }
    const s = map.get(p.user_id)!;
    s.total_picks += 1;
    s.total_units += parseFloat(String(p.units_result)) || 0;
  }

  // Ajout des pending counts
  for (const p of pendingPicks || []) {
    if (!map.has(p.user_id)) {
      map.set(p.user_id, {
        user_id: p.user_id,
        pseudo: "TIPSTER",
        avatar_url: null,
        email: null,
        paypal_email: null,
        total_picks: 0,
        total_units: 0,
        pending_picks: 0,
      });
    }
    map.get(p.user_id)!.pending_picks += 1;
  }

  const all = Array.from(map.values()).map((s) => ({
    ...s,
    total_units: Math.round(s.total_units * 100) / 100,
  }));

  const ranking = all
    .filter((s) => s.total_picks >= minPicks)
    .sort((a, b) => b.total_units - a.total_units);

  const non_eligible = all
    .filter((s) => s.total_picks < minPicks)
    .sort((a, b) => b.total_units - a.total_units);

  const pending_total = (pendingPicks || []).length;

  return { ranking, non_eligible, pending_total };
}

// ============================================================================
// POST — actions admin
// ============================================================================

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const action: string = body.action;
  const periodType: "week" | "month" = body.period_type;
  const scope: string = body.scope || "current"; // "current" | "previous" | "YYYY-MM-DD"

  if (!["week", "month"].includes(periodType)) {
    return NextResponse.json({ error: "Invalid period_type" }, { status: 400 });
  }

  try {
    const bounds = getPeriodBounds(periodType, scope);
    const config = await getConcoursConfig();
    const periodConfig = periodType === "week" ? config.week : config.month;

    if (!periodConfig.active) {
      return NextResponse.json({
        error: "Concours désactivé pour cette période",
        period_start: bounds.startDate,
      }, { status: 400 });
    }

    // ── PREVIEW : juste calculer le classement, ne rien insérer ──
    if (action === "preview") {
      const { ranking, non_eligible, pending_total } = await computeRanking(
        bounds.start,
        bounds.end,
        periodConfig.min_picks
      );

      // Vérifier si déjà clôturé
      const { data: existing } = await supabaseAdmin
        .from("tipster_concours_winners")
        .select("id, user_id, total_units, picks_count, created_at, email_sent_at, users:user_id(pseudo)")
        .eq("period_type", periodType)
        .eq("period_start", bounds.startDate)
        .maybeSingle();

      return NextResponse.json({
        period_type: periodType,
        period_start: bounds.startDate,
        period_end: bounds.endDate,
        min_picks: periodConfig.min_picks,
        prize: periodConfig.prize_amount,
        ranking,
        non_eligible,
        pending_total,
        already_closed: !!existing,
        existing_winner: existing || null,
      });
    }

    // ── CLOSE : valider et insérer le gagnant + envoyer email ──
    if (action === "close") {
      const skipPendingCheck: boolean = body.skip_pending_check === true;
      const sendEmailFlag: boolean = body.send_email !== false; // default true

      const { ranking, pending_total } = await computeRanking(
        bounds.start,
        bounds.end,
        periodConfig.min_picks
      );

      // Garde-fou : pending
      if (pending_total > 0 && !skipPendingCheck) {
        return NextResponse.json({
          error: "pending_exists",
          message: `${pending_total} pick(s) de cette période sont encore pending. Résous-les avant de clôturer, ou passe skip_pending_check=true.`,
          pending_total,
        }, { status: 400 });
      }

      // Déjà clôturé ?
      const { data: existing } = await supabaseAdmin
        .from("tipster_concours_winners")
        .select("id")
        .eq("period_type", periodType)
        .eq("period_start", bounds.startDate)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          error: "already_closed",
          message: "Cette période a déjà été clôturée. Supprime le row existant si tu veux refaire le calcul.",
          existing_id: existing.id,
        }, { status: 400 });
      }

      // Pas de gagnant éligible
      const winner = ranking[0];
      if (!winner) {
        return NextResponse.json({
          skipped: true,
          reason: "no_eligible_winner",
          message: `Aucun tipster n'a atteint le minimum de ${periodConfig.min_picks} pick(s) résolus sur cette période.`,
        });
      }

      // Insertion du gagnant
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("tipster_concours_winners")
        .insert({
          user_id: winner.user_id,
          period_type: periodType,
          period_start: bounds.startDate,
          period_end: bounds.endDate,
          total_units: winner.total_units,
          picks_count: winner.total_picks,
          prize_amount: periodConfig.prize_amount,
          paid: false,
          validated_by_admin: admin.id,
        })
        .select(`*, users:user_id (pseudo, email, paypal_email, locale)`)
        .single();

      if (insertError) throw insertError;

      // Envoi email
      let emailSent = false;
      let emailError: string | null = null;

      if (sendEmailFlag && winner.email) {
        try {
          const userLocale = ((inserted as any).users?.locale || "fr") as "fr" | "en" | "es";

          if (periodType === "week") {
            await sendConcoursWeekWinnerEmail(winner.email, userLocale, {
              pseudo: winner.pseudo,
              prize: periodConfig.prize_amount,
              totalUnits: winner.total_units,
              totalPicks: winner.total_picks,
              weekStart: bounds.start.toISOString(),
              weekEnd: bounds.end.toISOString(),
              paypalEmail: winner.paypal_email,
            });
          } else {
            // Format month label selon locale
            const monthLabel = bounds.start.toLocaleDateString(
              userLocale === "fr" ? "fr-FR" : userLocale === "es" ? "es-ES" : "en-GB",
              { month: "long", year: "numeric", timeZone: "Europe/Paris" }
            );
            await sendConcoursMonthWinnerEmail(winner.email, userLocale, {
              pseudo: winner.pseudo,
              prize: periodConfig.prize_amount,
              totalUnits: winner.total_units,
              totalPicks: winner.total_picks,
              monthLabel,
              paypalEmail: winner.paypal_email,
            });
          }

          // Marquer email envoyé
          await supabaseAdmin
            .from("tipster_concours_winners")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", (inserted as any).id);

          emailSent = true;
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
          console.error("[admin/tipster-concours] email error:", emailError);
        }
      }

      return NextResponse.json({
        success: true,
        winner: inserted,
        email_sent: emailSent,
        email_error: emailError,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/tipster-concours] POST error:", msg);
    return NextResponse.json({ error: "Server error", details: msg }, { status: 500 });
  }
}

// ============================================================================
// PATCH — marquer payé / annuler paiement
// ============================================================================

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { winner_id, paid, paid_note } = body;

  if (!winner_id) return NextResponse.json({ error: "Missing winner_id" }, { status: 400 });

  try {
    const updateData: Record<string, unknown> = { paid };
    if (paid) {
      updateData.paid_at = new Date().toISOString();
      updateData.paid_note = paid_note || null;
    } else {
      updateData.paid_at = null;
      updateData.paid_note = null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("tipster_concours_winners")
      .update(updateData)
      .eq("id", winner_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ winner: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/tipster-concours] PATCH error:", msg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ============================================================================
// DELETE — supprimer un winner (en cas d'erreur)
// ============================================================================

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const winnerId = searchParams.get("winner_id");

  if (!winnerId) return NextResponse.json({ error: "Missing winner_id" }, { status: 400 });

  try {
    const { error } = await supabaseAdmin
      .from("tipster_concours_winners")
      .delete()
      .eq("id", winnerId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/tipster-concours] DELETE error:", msg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ============================================================================
// GET — liste de tous les gagnants (page admin gains)
// ============================================================================

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: winners } = await supabaseAdmin
      .from("tipster_concours_winners")
      .select(`
        *,
        users:user_id (id, pseudo, avatar_url, email, paypal_email)
      `)
      .order("created_at", { ascending: false });

    return NextResponse.json({ winners: winners || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/tipster-concours] GET error:", msg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}