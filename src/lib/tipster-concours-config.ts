// src/lib/tipster-concours-config.ts
// Helper pour lire la config du concours c\u00f4t\u00e9 serveur

import { createClient as createAdminClient } from "@supabase/supabase-js";

type ConcoursConfig = {
  prize_amount: number;
  min_picks: number;
  active: boolean;
};

const FALLBACK: { week: ConcoursConfig; month: ConcoursConfig } = {
  week: { prize_amount: 10, min_picks: 3, active: true },
  month: { prize_amount: 40, min_picks: 10, active: true },
};

export async function getConcoursConfig(): Promise<{ week: ConcoursConfig; month: ConcoursConfig }> {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: configs } = await supabaseAdmin
      .from("tipster_concours_config")
      .select("period_type, prize_amount, min_picks, active");

    const week = configs?.find((c: any) => c.period_type === "week");
    const month = configs?.find((c: any) => c.period_type === "month");

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