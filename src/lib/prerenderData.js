// Public CMS content only; never credentials or visitor data.
export function readPrerenderData() {
  if (typeof document === "undefined") return {};
  const element = document.getElementById("repotracker-content");
  if (!element) return {};
  try { return JSON.parse(element.textContent); } catch { return {}; }
}
export function localizedField(field, locale) {
  if (typeof field === "string" || typeof field === "number") return field;
  return field?.[locale] ?? field?.["fi-FI"] ?? field?.["en-US"] ?? "";
}
export function findBySlug(entries, slug, lowerCase = false) {
  const normalize = (value) => lowerCase ? String(value).toLowerCase() : String(value);
  return entries.find(({ fields }) => {
    const values = typeof fields.slug === "string" ? [fields.slug] : Object.values(fields.slug || {});
    return values.some(value => normalize(value) === normalize(slug));
  });
}
export async function fetchAllEntries(client, contentType) {
  const items = [];
  for (let skip = 0; ; skip += 100) {
    const result = await client.withAllLocales.getEntries({ content_type: contentType, limit: 100, skip, order: "-sys.createdAt" });
    items.push(...result.items);
    if (items.length >= result.total || result.items.length < 100) return items;
  }
}
