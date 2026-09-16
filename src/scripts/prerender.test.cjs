const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRoutes, fetchAll, getContent, ROOT } = require("./lib/contentfulRoutes");
const { compileRenderer, safeJson } = require("./generateStaticMeta");
const data = require("./fixtures/content.json");

test("both localized article URLs and normalized place slugs are generated", () => {
  const routes = createRoutes(data);
  assert.equal(routes.find(r => r.p === "/blog/Aurora-test").language, "en");
  assert.equal(routes.find(r => r.p === "/blog/revontuli-testi").language, "fi");
  assert.ok(routes.some(r => r.p === "/places/rovaniemi"));
  assert.equal(routes.filter(r => r.kind === "place").length, 1);
  const bad = structuredClone(data);
  bad.posts[0].fields.slug["fi-FI"] = "../escape";
  assert.throws(() => createRoutes(bad), /Invalid CMS slug/);
  const duplicate = structuredClone(data);
  duplicate.posts.push({ ...duplicate.posts[0], sys: { id: "duplicate" } });
  assert.throws(() => createRoutes(duplicate), /Duplicate/);
});

test("CMS pagination includes entries beyond the first 100", async () => {
  const calls = [];
  const client = { withAllLocales: { getEntries: async query => {
    calls.push(query.skip);
    return { total: 101, items: Array.from({ length: query.skip ? 1 : 100 }, (_, i) => ({ id: i + query.skip })) };
  } } };
  assert.equal((await fetchAll(client, "post")).length, 101);
  assert.deepEqual(calls, [0, 100]);
});

test("inline JSON cannot terminate the script element", () => {
  const payload = { value: "</script><script>alert(1)</script>&\u2028" };
  assert.ok(!safeJson(payload).includes("<"));
  assert.deepEqual(JSON.parse(safeJson(payload)), payload);
});

test("actual page components produce full HTML, language metadata and working links", async () => {
  process.env.REACT_APP_CONTENTFUL_SPACE_ID = "test-space";
  process.env.REACT_APP_CONTENTFUL_ACCESS_TOKEN = "test-token";
  const render = await compileRenderer();
  for (const route of createRoutes(data)) {
    const { head, body } = render(route, data);
    assert.match(body, /<h1[ >]/, route.p);
    assert.equal((head.match(/<title>/g) || []).length, 1, route.p);
    assert.ok(!body.includes("Loading..."), route.p);
    assert.ok(!body.match(/(?:about|terms|privacy|faq)\.[aq]\./), route.p);
    if (route.kind === "post") {
      assert.match(body, route.language === "fi" ? /Tämän testikappaleen/ : /This public test paragraph/);
      assert.match(body, /href="\/faq"/);
      assert.match(head, new RegExp(`href="https://repotracker.fi${route.p}"`));
      if (route.language === "en") {
        assert.match(body, /<table>/);
        assert.ok(!body.includes("<script>alert(1)</script>"));
      }
    }
    if (route.p === "/terms" || route.p === "/about" || route.p === "/privacy") assert.match(body, /info.repotracker@gmail.com/);
  }
});

test("translation keys required by informational pages exist in both languages", () => {
  for (const lang of ["fi", "en"]) {
    const dictionary = require(`../lang/${lang}.json`);
    for (const name of ["Aboutpage", "TermsPage", "PrivacyPage", "FaqPage"]) {
      const source = fs.readFileSync(path.join(ROOT, `src/${name}.jsx`), "utf8");
      for (const match of source.matchAll(/["']((?:about|terms|privacy|faq)\.[\w.]+)["']/g)) assert.ok(dictionary[match[1]], `${lang}: ${match[1]}`);
    }
  }
});

test("fixture CMS data is refused on Vercel", async () => {
  process.env.REPO_TEST_CONTENT_PATH = path.join(__dirname, "fixtures/content.json");
  process.env.VERCEL = "1";
  try { await assert.rejects(getContent(), /cannot be deployed/); }
  finally { delete process.env.REPO_TEST_CONTENT_PATH; delete process.env.VERCEL; }
});
