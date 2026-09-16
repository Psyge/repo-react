const fs = require("node:fs");
const path = require("node:path");
const { getRoutes, SITE, ROOT, SNAPSHOT } = require("./lib/contentfulRoutes");
const esc = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function main() {
  // Never leave a previous snapshot available after a failed fetch.
  fs.rmSync(SNAPSHOT, { force: true });
  const { data, routes, stats } = await getRoutes();
  const included = routes.filter(route => route.sitemap !== false && !route.noindex);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + included.map(route => `  <url><loc>${esc(SITE + route.p)}</loc></url>`).join("\n") + '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, "public/sitemap.xml"), xml);
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ data, routes }));
  console.log(`Content and sitemap ready: ${stats.posts} posts, ${stats.places} places, ${included.length} URLs.`);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
