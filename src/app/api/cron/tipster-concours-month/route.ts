// src/app/api/cron/tipster-concours-month/route.ts
// Cron mensuel : calcul du gagnant du mois pr\u00e9c\u00e9dent
// Appell\u00e9 chaque 1er du mois \u00e0 00h30 par Vercel

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getConcoursConfig } from "@/lib/tipster-concours-config";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function getPreviousMonthBounds() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrev = new Date(firstOfMonth);
  lastOfPrev.setDate(firstOfMonth.getDate() - 1);
  lastOfPrev.setHours(23, 59, 59, 999);
  const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1, 0, 0, 0, 0);
  return { start: firstOfPrev, end: lastOfPrev };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logStart = new Date().toISOString();

  try {
    const bounds = getPreviousMonthBounds();
    const periodStart = bounds.start.toISOString().split("T")[0];
    const periodEnd = bounds.end.toISOString().split("T")[0];

    const config = await getConcoursConfig();
    if (!config.month.active) {
      return NextResponse.json({
        skipped: true,
        reason: "Concours mois d\u00e9sactiv\u00e9",
        period: periodStart,
      });
    }
    const minPicks = config.month.min_picks;
    const prize = config.month.prize_amount;

    const { data: existing } = await supabaseAdmin
      .from("tipster_concours_winners")
      .select("id")
      .eq("period_type", "month")
      .eq("period_start", periodStart)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        skipped: true,
        reason: "Already calculated",
        period: periodStart,
      });
    }

    const { data: picks } = await supabaseAdmin
      .from("tipster_picks")
      .select("user_id, units_result")
      .eq("status", "resolved")
      .gte("resolved_at", bounds.start.toISOString())
      .lte("resolved_at", bounds.end.toISOString());

    const map = new Map<string, { user_id: string; total_picks: number; total_units: number }>();
    for (const p of picks || []) {
      if (!map.has(p.user_id)) {
        map.set(p.user_id, { user_id: p.user_id, total_picks: 0, total_units: 0 });
      }
      const s = map.get(p.user_id)!;
      s.total_picks += 1;
      s.total_units += parseFloat(String(p.units_result)) || 0;
    }

    const eligible = Array.from(map.values()).filter((s) => s.total_picks >= minPicks);
    eligible.sort((a, b) => b.total_units - a.total_units);
    const winner = eligible[0] || null;

    if (!winner) {
      return NextResponse.json({
        skipped: true,
        reason: "No eligible winner",
        period: periodStart,
      });
    }

    const { data: inserted } = await supabaseAdmin
      .from("tipster_concours_winners")
      .insert({
        user_id: winner.user_id,
        period_type: "month",
        period_start: periodStart,
        period_end: periodEnd,
        total_units: Math.round(winner.total_units * 100) / 100,
        picks_count: winner.total_picks,
        prize_amount: prize,
        paid: false,
      })
      .select(`*, users:user_id (pseudo, email, paypal_email)`)
      .single();

    // Email au gagnant
    if (resend && inserted) {
      const user = (inserted as any).users;
      if (user?.email) {
        const monthName = bounds.start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

        try {
          await resend.emails.send({
            from: "PRONOS.CLUB <noreply@pronos.club>",
            to: user.email,
            replyTo: "contact@pronos.club",
            subject: "\ud83d\udc51 Tu es le tipster du mois \u00e0 PRONOS.CLUB !",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%); color: white; padding: 40px 24px; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="font-size: 56px; margin-bottom: 12px;">\ud83d\udc51</div>
                  <h1 style="font-size: 26px; font-weight: 800; margin: 0; color: #fbbf24;">Tipster du mois !</h1>
                  <p style="font-size: 16px; color: white; margin-top: 12px; font-weight: 700;">Bravo ${user.pseudo || ""}</p>
                  <p style="font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 4px;">Tu domines le classement mensuel \u00e0 PRONOS.CLUB</p>
                </div>

                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(251,191,36,0.3); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                  <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin: 0 0 8px;">Mois de</p>
                  <p style="font-size: 16px; font-weight: 700; color: white; margin: 0 0 20px; text-transform: capitalize;">${monthName}</p>

                  <div style="display: inline-block; background: linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(16,185,129,0.15) 100%); border: 2px solid rgba(251,191,36,0.4); border-radius: 12px; padding: 20px 40px;">
                    <p style="font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #fbbf24; margin: 0 0 4px;">Ton gain</p>
                    <p style="font-size: 48px; font-weight: 900; color: #fbbf24; margin: 0;">${prize} \u20ac</p>
                  </div>

                  <div style="display: flex; justify-content: space-around; margin-top: 28px; padding-top: 20px; border-top: 1px dashed rgba(255,255,255,0.1);">
                    <div>
                      <p style="font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin: 0;">Total U</p>
                      <p style="font-size: 20px; font-weight: 800; color: #34d399; margin: 4px 0 0;">+${Math.round(winner.total_units * 100) / 100}</p>
                    </div>
                    <div>
                      <p style="font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin: 0;">Pronos</p>
                      <p style="font-size: 20px; font-weight: 800; color: white; margin: 4px 0 0;">${winner.total_picks}</p>
                    </div>
                  </div>
                </div>

                ${!user.paypal_email ? `
                  <div style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                    <p style="font-size: 14px; font-weight: 700; color: #fbbf24; margin: 0 0 8px;">\u26a0\ufe0f Email PayPal requis</p>
                    <p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 0; line-height: 1.5;">
                      Pour recevoir ton gain, ajoute ton email PayPal dans ton profil : <a href="https://pronos.club/fr/espace/profil" style="color: #34d399; text-decoration: none;">\u26a1 Configurer mon PayPal</a>
                    </p>
                  </div>
                ` : `
                  <div style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
                    <p style="font-size: 13px; color: rgba(255,255,255,0.7); margin: 0;">Ton gain sera envoy\u00e9 sur <strong style="color: #34d399;">${user.paypal_email}</strong> dans les 48h.</p>
                  </div>
                `}

                <div style="text-align: center;">
                  <a href="https://pronos.club/fr/pronos-abonnes/concours" style="display: inline-block; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #0a0a0a; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 14px;">\ud83c\udfc6 Voir le concours</a>
                </div>

                <p style="text-align: center; font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 32px; letter-spacing: 0.1em;">PRONOS.CLUB \u00b7 Le champion du mois \ud83d\udc51</p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error("[cron month] email error:", emailErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      winner: inserted,
      period: periodStart,
      executed_at: logStart,
    });

  } catch (err: any) {
    console.error("[cron month] error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}