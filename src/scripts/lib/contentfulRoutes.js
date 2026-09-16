const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("contentful");
const SITE = "https://repotracker.fi";
const ROOT = path.resolve(__dirname, "../../..");
const SNAPSHOT = path.join(ROOT, ".cache/content.json");

function loadDotEnv() {
  // Match CRA production precedence; Vercel environment variables win.
  for (const name of [".env.production.local", ".env.local", ".env.production", ".env"]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || match[1] in process.env) continue;
      let value = match[2];
      if (/^["']/.test(value) && value.at(-1) === value[0]) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, "");
      process.env[match[1]] = value;
    }
  }
}
function text(field, locale, fallback = "fi-FI") {
  const value = typeof field === "object" && field !== null ? field[locale] ?? field[fallback] ?? field["en-US"] : field;
  return typeof value === "string" ? value.trim() : "";
}
function slugValue(value) {
  if (!value || value === "." || value === ".." || /[/\\?#%<>:\s]/u.test(value)) throw new Error(`Invalid CMS slug: ${value}`);
  return value;
}
async function fetchAll(client, contentType) {
  const items = [];
  for (let skip = 0; ; skip += 100) {
    const response = await client.withAllLocales.getEntries({ content_type: contentType, limit: 100, skip, order: "-sys.createdAt" });
    items.push(...response.items);
    if (items.length >= response.total || response.items.length < 100) return items;
  }
}
function publicEntry(item, fields) {
  return { sys: { id: item.sys.id, updatedAt: item.sys.updatedAt }, fields: Object.fromEntries(fields.filter(key => item.fields[key] !== undefined).map(key => [key, item.fields[key]])) };
}
async function getContent() {
  loadDotEnv();
  if (process.env.REPO_TEST_CONTENT_PATH) {
    if (process.env.VERCEL) throw new Error("Fixture content cannot be deployed to Vercel.");
    return { ...JSON.parse(fs.readFileSync(process.env.REPO_TEST_CONTENT_PATH, "utf8")), fixture: true };
  }
  const space = process.env.REACT_APP_CONTENTFUL_SPACE_ID;
  const accessToken = process.env.REACT_APP_CONTENTFUL_ACCESS_TOKEN;
  if (!space || !accessToken) throw new Error("Set REACT_APP_CONTENTFUL_SPACE_ID and REACT_APP_CONTENTFUL_ACCESS_TOKEN in Vercel or a project-root .env file.");
  const client = createClient({ space, accessToken, environment: "master", retryLimit: 2, timeout: 20000, logHandler: () => {} });
  let posts, places;
  try { [posts, places] = await Promise.all([fetchAll(client, "post"), fetchAll(client, "place")]); }
  catch { throw new Error("Contentful content could not be fetched. Check credentials, content types and service availability. Deployment stopped to avoid publishing empty pages."); }
  if (!posts.length) throw new Error("Contentful returned no published posts; refusing an empty article build.");
  return {
    posts: posts.map(item => publicEntry(item, ["slug", "title", "excerpt", "content"])),
    places: places.map(item => publicEntry(item, ["slug", "name", "title", "short", "description", "lat", "lon"])),
  };
}
function createRoutes({ posts, places }) {
  const en = require("../../lang/en.json");
  const routes = [
    { p: "/", title: "Northern Lights Forecast Finland | RepoTracker", desc: "Live Northern Lights forecast, Kp index, solar wind and aurora map for Finland and Lapland.", priority: "1.0", changefreq: "hourly" },
    { p: "/map", title: "Northern Lights Map Finland | RepoTracker", desc: "Explore northern lights conditions with the interactive aurora forecast map.", priority: "0.9" },
    { p: "/blog", title: `${en["blog.title"]} | RepoTracker`, desc: en["blog.intro"], priority: "0.8" },
    ...["about", "terms", "privacy", "faq"].map(name => ({ p: `/${name}`, title: `${en[`${name}.title`]} | RepoTracker`, desc: en[`${name}.intro`] })),
    { p: "/contact", title: "Contact | RepoTracker", desc: en["contact.sub"] },
    { p: "/premium", title: en["premium.pagetitle"], desc: en["premium.sub"] },
    { p: "/alerts", title: "Aurora Alerts | RepoTracker", desc: en["alerts.subtitle"], sitemap: false },
    { p: "/premium-success", title: "Premium activation | RepoTracker", desc: "Your Premium purchase is being processed.", sitemap: false, noindex: true },
    { p: "/MidNightSunV2", title: "Midnight sun | RepoTracker", desc: "Explore daylight and darkness for aurora watching.", sitemap: false },
    { p: "/404", title: "Page not found | RepoTracker", desc: "The requested page could not be found.", sitemap: false, noindex: true },
  ].map(route => ({ language: "en", ...route }));
  for (const item of posts) {
    const fields = item.fields;
    const seen = new Set();
    for (const [locale, language] of [["en-US", "en"], ["fi-FI", "fi"]]) {
      // Do not manufacture a translation URL for a missing localized slug.
      const rawSlug = typeof fields.slug === "string" ? fields.slug : fields.slug?.[locale];
      if (!rawSlug || seen.has(rawSlug)) continue;
      const slug = slugValue(rawSlug);
      seen.add(slug);
      const title = text(fields.title, locale);
      const content = text(fields.content, locale);
      if (!title || !content) throw new Error(`Post ${item.sys.id} lacks a title or Markdown content (${locale}).`);
      routes.push({ p: `/blog/${slug}`, language, kind: "post", id: item.sys.id, title: `${title} | RepoTracker`, desc: text(fields.excerpt, locale), priority: "0.6" });
    }
    if (!seen.size) throw new Error(`Post ${item.sys.id} has no slug.`);
  }
  for (const item of places) {
    const seen = new Set();
    for (const [locale, language] of [["en-US", "en"], ["fi-FI", "fi"]]) {
      const slug = text(item.fields.slug, locale).toLowerCase();
      if (!slug || seen.has(slug)) continue;
      slugValue(slug);
      seen.add(slug);
      const name = text(item.fields.name, locale) || text(item.fields.title, locale);
      const description = text(item.fields.description, locale) || text(item.fields.short, locale);
      if (!name || !description) throw new Error(`Place ${item.sys.id} has no localized name or description.`);
      routes.push({ p: `/places/${slug}`, language, kind: "place", id: item.sys.id, title: `${name} | RepoTracker`, desc: text(item.fields.short, locale) || description, priority: "0.7" });
    }
  }
  const paths = routes.map(route => route.p);
  if (new Set(paths).size !== paths.length) throw new Error("Duplicate public CMS routes; resolve conflicting slugs before deployment.");
  return routes;
}
async function getRoutes() {
  const data = await getContent();
  return { data, routes: createRoutes(data), stats: { posts: data.posts.length, places: data.places.length } };
}
module.exports = { getRoutes, getContent, createRoutes, fetchAll, loadDotEnv, SITE, ROOT, SNAPSHOT };
