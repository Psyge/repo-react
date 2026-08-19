/* ============================================================
 * SITEMAPIN GENEROINTI
 * ============================================================
 * Ajetaan ennen buildia (package.json: "prebuild").
 *
 * Reitit haetaan Contentfulista lib/contentfulRoutes.js:n kautta.
 * Aiemmin tässä oli käsin ylläpidetyt listat, ja ne olivat jäljessä:
 * sitemapissa oli kolme artikkelia yhdeksästä ja paikkoja joille ei
 * ollut lainkaan sisältöä. Nyt julkaistu sisältö päätyy sitemappiin
 * itsestään eikä listoja tarvitse muistaa päivittää.
 *
 * lastmod jätetään tarkoituksella pois: build-hetken päivämäärä ei
 * kerro milloin sisältö muuttui vaan milloin ajoit buildin. Jokainen
 * deploy merkitsisi kaikki sivut muuttuneiksi, ja juuri sellaisen
 * epäluotettavan lastmodin hakukoneet oppivat ohittamaan.
 * ============================================================ */

const fs = require("fs");
const path = require("path");
const { getRoutes, SITE } = require("./lib/contentfulRoutes");

function urlBlock(r) {
  return [
    "  <url>",
    `    <loc>${SITE}${r.p}</loc>`,
    `    <changefreq>${r.changefreq || "monthly"}</changefreq>`,
    `    <priority>${r.priority || "0.5"}</priority>`,
    "  </url>",
  ].join("\n");
}

async function main() {
  const { routes, stats } = await getRoutes();

  /* Mukaan vain indeksoitavat sivut. sitemap: false rajaa pois
     /alerts- ja /premium-success-sivut, joilla ei ole arvoa hakijalle. */
  const included = routes.filter((r) => r.sitemap !== false && !r.noindex);

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    included.map(urlBlock).join("\n") +
    "\n</urlset>\n";

  const out = path.join(__dirname, "..", "..", "public", "sitemap.xml");
  fs.writeFileSync(out, xml, "utf8");

  console.log(
    `✓ sitemap.xml generoitu — ${included.length} osoitetta ` +
      `(${stats.posts} artikkelia, ${stats.places} paikkaa)`
  );
}

main().catch((e) => {
  /* Build EI kaadu jos Contentful ei vastaa. Vanha sitemap.xml jää
     silloin paikalleen, mikä on parempi kuin keskeytynyt deploy —
     mutta virhe tulostetaan, jotta se huomataan. */
  console.error("✗ sitemapin generointi epäonnistui:", e.message);
  console.error("  Vanha public/sitemap.xml jää käyttöön.");
});