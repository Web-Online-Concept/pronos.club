import { NextResponse } from "next/server";
import { recalcBankrollUnits } from "@/lib/bankroll-utils";

export async function GET(request: Request) {
  // Auth: Vercel cron header or CRON_SECRET
  const cronHeader = request.headers.get("x-vercel-cron");
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronHeader !== "1" && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine which period to recalc based on day
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday
  const dayOfMonth = now.getUTCDate();

  const results: Record<string, unknown>[] = [];

  // Weekly: runs every Monday
  if (dayOfWeek === 1) {
    const weeklyResult = await recalcBankrollUnits("weekly");
    results.push({ period: "weekly", ...weeklyResult });
  }

  // Monthly: runs on the 1st
  if (dayOfMonth === 1) {
    const monthlyResult = await recalcBankrollUnits("monthly");
    results.push({ period: "monthly", ...monthlyResult });
  }

  if (results.length === 0) {
    return NextResponse.json({ message: "No recalculation needed today", day: dayOfWeek, date: dayOfMonth });
  }

  return NextResponse.json({ results });
}