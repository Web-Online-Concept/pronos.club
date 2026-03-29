import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET — payments list + accounting stats
export async function GET(request: Request) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "payments"; // payments | accounting | partner-payments
  const month = searchParams.get("month"); // YYYY-MM format

  if (type === "payments") {
    let query = supabaseAdmin
      .from("payments")
      .select("*, users(email, pseudo, display_name)")
      .order("paid_at", { ascending: false });

    if (month) {
      const [y, m] = month.split("-");
      const start = `${month}-01T00:00:00Z`;
      const end = new Date(parseInt(y), parseInt(m), 0);
      const endStr = `${month}-${end.getDate()}T23:59:59Z`;
      query = query.gte("paid_at", start).lte("paid_at", endStr);
    }

    const { data, error } = await query.limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  if (type === "accounting") {
    // Get all paid payments
    let query = supabaseAdmin
      .from("payments")
      .select("amount, stripe_fee, net_amount, paid_at, status")
      .eq("status", "paid");

    if (month) {
      const [y, m] = month.split("-");
      const start = `${month}-01T00:00:00Z`;
      const end = new Date(parseInt(y), parseInt(m), 0);
      const endStr = `${month}-${end.getDate()}T23:59:59Z`;
      query = query.gte("paid_at", start).lte("paid_at", endStr);
    }

    const { data: payments } = await query;
    const all = payments || [];

    const totalBrut = all.reduce((s, p) => s + (p.amount || 0), 0);
    const totalFees = all.reduce((s, p) => s + (p.stripe_fee || 0), 0);
    const totalNet = all.reduce((s, p) => s + (p.net_amount || 0), 0);
    const partFlorent = Math.floor(totalNet / 2);
    const partJerome = totalNet - partFlorent;

    // Get partner payments
    let partnerQuery = supabaseAdmin
      .from("partner_payments")
      .select("partner, amount, paid_at");

    if (month) {
      const [y, m] = month.split("-");
      const start = `${month}-01T00:00:00Z`;
      const end = new Date(parseInt(y), parseInt(m), 0);
      const endStr = `${month}-${end.getDate()}T23:59:59Z`;
      partnerQuery = partnerQuery.gte("paid_at", start).lte("paid_at", endStr);
    }

    const { data: partnerPayments } = await partnerQuery;
    const pp = partnerPayments || [];

    const paidFlorent = pp.filter(p => p.partner === "florent").reduce((s, p) => s + p.amount, 0);
    const paidJerome = pp.filter(p => p.partner === "jerome").reduce((s, p) => s + p.amount, 0);

    return NextResponse.json({
      transactions: all.length,
      totalBrut,
      totalFees,
      totalNet,
      partFlorent,
      partJerome,
      paidFlorent,
      paidJerome,
      dueFlorent: partFlorent - paidFlorent,
      dueJerome: partJerome - paidJerome,
    });
  }

  if (type === "partner-payments") {
    const partner = searchParams.get("partner");

    let query = supabaseAdmin
      .from("partner_payments")
      .select("*")
      .order("paid_at", { ascending: false });

    if (partner) query = query.eq("partner", partner);

    if (month) {
      const [y, m] = month.split("-");
      const start = `${month}-01T00:00:00Z`;
      const end = new Date(parseInt(y), parseInt(m), 0);
      const endStr = `${month}-${end.getDate()}T23:59:59Z`;
      query = query.gte("paid_at", start).lte("paid_at", endStr);
    }

    const { data, error } = await query.limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

// POST — add partner payment
export async function POST(request: Request) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { partner, amount, method, note, paid_at } = body;

  if (!partner || !amount) {
    return NextResponse.json({ error: "Partner and amount required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_payments")
    .insert({
      partner,
      amount: Math.round(amount),
      method: method || "virement",
      note: note || null,
      paid_at: paid_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — remove partner payment
export async function DELETE(request: Request) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("partner_payments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}