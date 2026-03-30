/**
 * Blog i18n helper — picks the right localized field with FR fallback
 * Usage: localized(post, "title", locale) → post.title_en || post.title
 */
export function localized(
  obj: Record<string, unknown>,
  field: string,
  locale: string
): string {
  if (locale === "fr") return (obj[field] as string) || "";
  const locField = `${field}_${locale}`;
  return ((obj[locField] as string) || (obj[field] as string)) || "";
}