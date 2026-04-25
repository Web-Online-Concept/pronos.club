const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

export type AdminNotifyInput = {
  level: "info" | "warning" | "error";
  title: string;
  message: string;
  details?: Record<string, unknown>;
};

const formatMessage = (input: AdminNotifyInput): string => {
  const emoji =
    input.level === "error" ? "🚨" : input.level === "warning" ? "⚠️" : "ℹ️";
  const lines: string[] = [];
  lines.push(`${emoji} *${input.title}*`);
  lines.push("");
  lines.push(input.message);

  if (input.details) {
    lines.push("");
    lines.push("```");
    for (const [key, value] of Object.entries(input.details)) {
      let displayValue = "";
      if (typeof value === "object" && value !== null) {
        displayValue = JSON.stringify(value);
      } else {
        displayValue = String(value);
      }
      if (displayValue.length > 100) {
        displayValue = displayValue.slice(0, 100) + "...";
      }
      lines.push(`${key}: ${displayValue}`);
    }
    lines.push("```");
  }

  lines.push("");
  lines.push(`_${new Date().toISOString()}_`);
  return lines.join("\n");
};

export const notifyAdmin = async (
  input: AdminNotifyInput
): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn(
      "[notify-admin] Telegram not configured (TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID missing)"
    );
    return;
  }

  const text = formatMessage(input);

  try {
    const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.warn(
        "[notify-admin] Telegram API returned error:",
        response.status,
        errBody.slice(0, 200)
      );
    }
  } catch (err) {
    console.warn(
      "[notify-admin] Failed to send Telegram notification:",
      err instanceof Error ? err.message : err
    );
  }
};

export const notifyCronGenerateSuccess = async (data: {
  date: string;
  classicCount: number;
  scorerCount: number;
  totalCostUsd: number;
  durationMs: number;
}): Promise<void> => {
  const isEmpty = data.classicCount === 0 && data.scorerCount === 0;
  await notifyAdmin({
    level: isEmpty ? "warning" : "info",
    title: isEmpty ? "Pronos IA: jour blanc" : "Pronos IA: nouveaux picks",
    message: isEmpty
      ? "Aucun pick n'a été retenu aujourd'hui. Les seuils de consensus n'ont pas été atteints."
      : `${data.classicCount} pick(s) classique(s) et ${data.scorerCount} buteur(s) ont été publiés.`,
    details: {
      Date: data.date,
      Classiques: data.classicCount,
      Buteurs: data.scorerCount,
      Coût: `$${data.totalCostUsd.toFixed(4)}`,
      Durée: `${(data.durationMs / 1000).toFixed(1)}s`,
    },
  });
};

export const notifyCronGenerateError = async (data: {
  date: string;
  error: string;
}): Promise<void> => {
  await notifyAdmin({
    level: "error",
    title: "Pronos IA: échec génération",
    message: "Le cron de génération des picks IA a échoué.",
    details: {
      Date: data.date,
      Erreur: data.error,
    },
  });
};

export const notifyCronResolveSummary = async (data: {
  v1Resolved: number;
  v2Resolved: number;
  v1Errors: number;
  v2Errors: number;
}): Promise<void> => {
  const totalResolved = data.v1Resolved + data.v2Resolved;
  const totalErrors = data.v1Errors + data.v2Errors;

  if (totalResolved === 0 && totalErrors === 0) return;

  await notifyAdmin({
    level: totalErrors > 0 ? "warning" : "info",
    title: "Pronos IA: résolutions",
    message: `${totalResolved} pick(s) résolu(s) ${
      totalErrors > 0 ? `(${totalErrors} erreurs)` : ""
    }`,
    details: {
      "Résolus v1 (ESPN)": data.v1Resolved,
      "Résolus v2 (API-Football)": data.v2Resolved,
      "Erreurs v1": data.v1Errors,
      "Erreurs v2": data.v2Errors,
    },
  });
};