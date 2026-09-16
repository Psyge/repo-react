const fs = require("node:fs");
const path = require("node:path");
const { transformSync } = require("esbuild");
const { loadDotEnv, ROOT, SNAPSHOT } = require("./lib/contentfulRoutes");
const BUILD = path.join(ROOT, "build");

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
function pageData(route, data) {
  const summary = post => ({ sys: post.sys, fields: { slug: post.fields.slug, title: post.fields.title, excerpt: post.fields.excerpt } });
  if (route.kind === "post") return { posts: data.posts.filter(item => item.sys.id === route.id) };
  if (route.kind === "place") return { places: data.places.filter(item => item.sys.id === route.id) };
  if (route.p === "/blog") return { posts: data.posts.map(summary) };
  if (route.p === "/") return { posts: data.posts.slice(0, 3).map(summary) };
  return {};
}
async function compileRenderer() {
  // Transpile only our source files while loading the server entry. Packages
  // retain Node's own loaders, including ReactMarkdown's ESM dependencies.
  const originalJs = require.extensions[".js"];
  const originalJsx = require.extensions[".jsx"];
  const sourceRoot = path.join(ROOT, "src") + path.sep;
  const loadSource = (module, filename) => {
    if (!filename.startsWith(sourceRoot)) return originalJs(module, filename);
    const result = transformSync(fs.readFileSync(filename, "utf8"), {
      loader: "jsx", format: "cjs", jsx: "automatic", target: "node22", sourcefile: filename,
    });
    module._compile(result.code, filename);
  };
  require.extensions[".js"] = loadSource;
  require.extensions[".jsx"] = loadSource;
  try { return require("./prerenderEntry.jsx").renderPage; }
  finally {
    require.extensions[".js"] = originalJs;
    if (originalJsx) require.extensions[".jsx"] = originalJsx;
    else delete require.extensions[".jsx"];
  }
}
async function main() {
  loadDotEnv();
  const { data, routes } = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
  if (data.fixture && process.env.VERCEL) throw new Error("Refusing to deploy fixture content.");
  const indexPath = path.join(BUILD, "index.html");
  const template = fs.readFileSync(indexPath, "utf8");
  if (!/<div id="root"><\/div>/.test(template)) throw new Error("Expected fresh CRA HTML; run npm run build before prerendering.");
  const renderPage = await compileRenderer();
  for (const route of routes) {
    const rendered = renderPage(route, data);
    if (!rendered.body.includes("<h1")) throw new Error(`Prerender produced no heading: ${route.p}`);
    let head = rendered.head;
    if (data.fixture) head = head.replace(/content="index, follow"/g, 'content="noindex, nofollow"');
    head = head.replace(/<(title|meta|link|script)\b/g, '<$1 data-prerender-seo="true"');
    const payload = `<script id="repotracker-content" type="application/json">${safeJson(pageData(route, data))}</script>`;
    const html = template
      .replace(/<html[^>]*>/, `<html lang="${route.language}"${route.kind ? ` data-route-language="${route.language}"` : ""}>`)
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+name="description"[^>]*>/i, "")
      .replace("</head>", () => `${head}</head>`)
      .replace('<div id="root"></div>', () => rendered.body + payload);
    const output = route.p === "/" ? indexPath : route.p === "/404" ? path.join(BUILD, "404.html") : path.join(BUILD, ...route.p.split("/").filter(Boolean), "index.html");
    const relative = path.relative(BUILD, output);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Output path escapes build directory.");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, html);
  }
  console.log(`Prerendered body content and metadata for ${routes.length} routes (including localized article URLs).`);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main, compileRenderer, pageData, safeJson };
