// src/app/api/admin/trigger-cron/route.ts
// Route admin pour déclencher les CRONs manuellement
// Le CRON_SECRET reste côté serveur — jamais exposé au client

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

const ALLOWED_CRONS = ["auto-news", "auto-videos", "emails", "expire-subscriptions", "recalc-bankroll"];

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cron } = await request.json();

  if (!cron || !ALLOWED_CRONS.includes(cron)) {
    return NextResponse.json({ error: "Invalid cron name" }, { status: 400 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pronos.club";
    const res = await fetch(`${baseUrl}/api/cron/${cron}?secret=${encodeURIComponent(secret)}`, {
      signal: AbortSignal.timeout(120000),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}