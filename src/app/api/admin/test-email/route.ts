import { requireAdmin, getCurrentUser } from "@/lib/auth";
import {
  sendWelcomeEmail,
  sendWelcomePremiumEmail,
  sendNewPickEmail,
  sendCancellationEmail,
  sendWinbackDay7Email,
  sendWinbackDay30Email,
  sendPremiumExpiringEmail,
  sendInactivityEmail,
  sendBilanEmail,
} from "@/lib/emails";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type) {
    return NextResponse.json({ error: "Missing email type" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const email = user?.email || admin?.email;
  const name = user?.pseudo || user?.display_name || email?.split("@")[0] || "Test";

  if (!email) {
    return NextResponse.json({ error: "No email found" }, { status: 400 });
  }

  let success = false;

  switch (type) {
    case "welcome":
      success = await sendWelcomeEmail(email, name);
      break;
    case "welcome-premium":
      success = await sendWelcomePremiumEmail(email, name, "https://t.me/+test_link_example");
      break;
    case "new-pick":
      success = await sendNewPickEmail(email, "Football", false);
      break;
    case "bilan":
      success = await sendBilanEmail(email, name, "Mars 2026", "2026-03", {
        totalPicks: 67,
        winRate: 58,
        roi: 12,
        profit: 8.5,
      });
      break;
    case "cancellation":
      success = await sendCancellationEmail(email, name, "25 avril 2026");
      break;
    case "winback-7":
      success = await sendWinbackDay7Email(email, name);
      break;
    case "winback-30":
      success = await sendWinbackDay30Email(email, name, 8.5, 58, 67);
      break;
    case "premium-expiring":
      success = await sendPremiumExpiringEmail(email, name, "26 mars 2026");
      break;
    case "inactivity":
      success = await sendInactivityEmail(email, name);
      break;
    default:
      return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
  }

  return NextResponse.json({ success, type, sentTo: email });
}