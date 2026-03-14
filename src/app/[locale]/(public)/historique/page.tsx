import { useTranslations } from "next-intl";

export default function HistoryPage() {
  const t = useTranslations("picks");
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-4 opacity-60">Page en construction...</p>
    </main>
  );
}
