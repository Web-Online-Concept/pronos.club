// src/lib/tipster-concours-config.ts
// Helper pour lire la config du concours côté serveur
// Intègre l'auto-application des valeurs programmées quand la date effective est atteinte

import { createClient as createAdminClient } from "@supabase/supabase-js";

type ConcoursConfig = {
  prize_amount: number;
  min_picks: number;
  active: boolean;
};

type ConcoursConfigWithScheduled = ConcoursConfig & {
  scheduled_prize_amount: number | null;
  scheduled_min_picks: number | null;
  scheduled_active: boolean | null;
  scheduled_effective_date: string | null;
};

const FALLBACK: { week: ConcoursConfig; month: ConcoursConfig } = {
  week: { prize_amount: 10, min_picks: 3, active: true },
  month: { prize_amount: 40, min_picks: 10, active: true },
};

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Applique la valeur programmée si la date effective est atteinte
// - archive l'ancienne valeur dans l'historique
// - remplace la valeur actuelle par la programmée
// - vide les champs scheduled_*
async function applyScheduledIfDue(row: any): Promise<any> {
  if (!row.scheduled_effective_date || !row.scheduled_prize_amount) return row;

  const effectiveDate = new Date(row.scheduled_effective_date).getTime();
  if (Date.now() < effectiveDate) return row; // pas encore

  const admin = getAdmin();
  const now = new Date().toISOString();

  try {
    // 1. Fermer l'entrée historique courante (effective_to = maintenant)
    await admin
      .from("tipster_concours_config_history")
      .update({ effective_to: now })
      .eq("period_type", row.period_type)
      .is("effective_to", null);

    // 2. Créer une nouvelle entrée historique avec la nouvelle valeur
    await admin
      .from("tipster_concours_config_history")
      .insert({
        period_type: row.period_type,
        prize_amount: row.scheduled_prize_amount,
        min_picks: row.scheduled_min_picks ?? row.min_picks,
        active: row.scheduled_active ?? row.active,
        effective_from: row.scheduled_effective_date,
      });

    // 3. Appliquer à la config courante + vider scheduled_*
    const newValues = {
      prize_amount: row.scheduled_prize_amount,
      min_picks: row.scheduled_min_picks ?? row.min_picks,
      active: row.scheduled_active ?? row.active,
      scheduled_prize_amount: null,
      scheduled_min_picks: null,
      scheduled_active: null,
      scheduled_effective_date: null,
      updated_at: now,
    };

    const { data: updated } = await admin
      .from("tipster_concours_config")
      .update(newValues)
      .eq("period_type", row.period_type)
      .select()
      .single();

    return updated || { ...row, ...newValues };
  } catch (err) {
    console.error("[concours-config] applyScheduled error:", err);
    return row;
  }
}

// Version simple (pour compatibilité avec code existant)
export async function getConcoursConfig(): Promise<{ week: ConcoursConfig; month: ConcoursConfig }> {
  try {
    const admin = getAdmin();

    const { data: configs } = await admin
      .from("tipster_concours_config")
      .select("*");

    if (!configs) return FALLBACK;

    // Applique les valeurs programmées si échues
    const processed = await Promise.all(configs.map(applyScheduledIfDue));

    const week = processed.find((c: any) => c.period_type === "week");
    const month = processed.find((c: any) => c.period_type === "month");

    return {
      week: week ? {
        prize_amount: Number(week.prize_amount),
        min_picks: week.min_picks,
        active: week.active,
      } : FALLBACK.week,
      month: month ? {
        prize_amount: Number(month.prize_amount),
        min_picks: month.min_picks,
        active: month.active,
      } : FALLBACK.month,
    };
  } catch {
    return FALLBACK;
  }
}

// Version avec scheduled (pour la page admin)
export async function getConcoursConfigFull(): Promise<{
  week: ConcoursConfigWithScheduled;
  month: ConcoursConfigWithScheduled;
}> {
  try {
    const admin = getAdmin();

    const { data: configs } = await admin
      .from("tipster_concours_config")
      .select("*");

    if (!configs) {
      return {
        week: { ...FALLBACK.week, scheduled_prize_amount: null, scheduled_min_picks: null, scheduled_active: null, scheduled_effective_date: null },
        month: { ...FALLBACK.month, scheduled_prize_amount: null, scheduled_min_picks: null, scheduled_active: null, scheduled_effective_date: null },
      };
    }

    const processed = await Promise.all(configs.map(applyScheduledIfDue));

    const week = processed.find((c: any) => c.period_type === "week");
    const month = processed.find((c: any) => c.period_type === "month");

    const mapFull = (c: any, fallback: ConcoursConfig): ConcoursConfigWithScheduled => ({
      prize_amount: Number(c?.prize_amount ?? fallback.prize_amount),
      min_picks: c?.min_picks ?? fallback.min_picks,
      active: c?.active ?? fallback.active,
      scheduled_prize_amount: c?.scheduled_prize_amount !== null && c?.scheduled_prize_amount !== undefined ? Number(c.scheduled_prize_amount) : null,
      scheduled_min_picks: c?.scheduled_min_picks ?? null,
      scheduled_active: c?.scheduled_active ?? null,
      scheduled_effective_date: c?.scheduled_effective_date ?? null,
    });

    return {
      week: mapFull(week, FALLBACK.week),
      month: mapFull(month, FALLBACK.month),
    };
  } catch {
    return {
      week: { ...FALLBACK.week, scheduled_prize_amount: null, scheduled_min_picks: null, scheduled_active: null, scheduled_effective_date: null },
      month: { ...FALLBACK.month, scheduled_prize_amount: null, scheduled_min_picks: null, scheduled_active: null, scheduled_effective_date: null },
    };
  }
}

// Calcule la prochaine date d'entrée en vigueur
// - week : lundi prochain 00h00 (Europe/Paris)
// - month : 1er du mois prochain 00h00
export function getNextPeriodStart(periodType: "week" | "month"): Date {
  const now = new Date();

  if (periodType === "week") {
    // Prochain lundi 00h00
    const next = new Date(now);
    const day = next.getDay(); // 0 = dimanche, 1 = lundi, ...
    const daysUntilMonday = day === 0 ? 1 : (8 - day);
    next.setDate(next.getDate() + daysUntilMonday);
    next.setHours(0, 0, 0, 0);
    return next;
  } else {
    // 1er du mois prochain 00h00
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return next;
  }
}