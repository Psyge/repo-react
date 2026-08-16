/* ============================================================
 * SITEMAPIN GENEROINTI
 * ============================================================
 * Ajetaan buildin yhteydessä (ks. package.json prebuild).
 *
 * SYY: sitemap.xml oli käsin ylläpidetty ja jäi jälkeen joka kerta
 * kun reittejä lisättiin. Siitä puuttuivat /about, /alerts ja kaikki
 * yhdeksän paikkasivua — juuri ne joilla on eniten hakukonearvoa
 * ("revontulet Levillä" on tarkalleen se mitä turisti hakee).
 *
 * Paikat luetaan samasta data/places.js -tiedostosta jota sivusto
 * käyttää, joten uusi paikka päätyy sitemapiin automaattisesti.
 *
 * MITÄ EI OLE MUKANA JA MIKSI:
 *   /premium-success  kuittaussivu, noindex
 *   /alerts           premium-asetussivu, ei sisältöä hakijalle
 *   /MidNightSunV2    sisäinen näkymä
 *   404               ei koskaan sitemapiin
 *
 * BLOGIARTIKKELIT: nämä tulevat Contentfulista eikä niitä voi lukea
 * ilman API-avainta. Lisää uudet slugit BLOG_SLUGS-listaan kun
 * julkaiset artikkelin — tai laajenna tämä hakemaan ne Contentfulista
 * jos artikkeleita alkaa tulla tiheämpään.
 * ============================================================ */

const fs = require("fs");
const path = require("path");

const SITE = "https://repotracker.fi";

/* Luetaan paikat suoraan lähdetiedostosta. Yksinkertainen regex riittää:
   tiedosto on käsin ylläpidetty lista, ei generoitua koodia. */
function readPlaceSlugs() {
  const file = path.join(__dirname, "..", "data", "places.js");
  const src = fs.readFileSync(file, "utf8");
  const slugs = [];
  const re = /slug:\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(src)) !== null) slugs.push(m[1]);
  return slugs;
}

const STATIC_PATHS = [
  { path: "/",        priority: "1.0", changefreq: "hourly"  },
  { path: "/map",     priority: "0.9", changefreq: "hourly"  },
  { path: "/blog",    priority: "0.8", changefreq: "weekly"  },
  { path: "/faq",     priority: "0.7", changefreq: "monthly" },
  { path: "/premium", priority: "0.7", changefreq: "monthly" },
  { path: "/about",   priority: "0.5", changefreq: "yearly"  },
  { path: "/contact", priority: "0.4", changefreq: "yearly"  },
  { path: "/privacy", priority: "0.3", changefreq: "yearly"  },
  { path: "/terms",   priority: "0.3", changefreq: "yearly"  },
];

const BLOG_SLUGS = ["photography", "forecast", "best-time"];

/* lastmod jätetään tarkoituksella pois.
 *
 * Build-hetken päivämäärä ei kerro milloin SISÄLTÖ muuttui — se kertoo
 * milloin ajoit buildin. Jokainen deploy merkitsisi kaikki sivut
 * muuttuneiksi, ja juuri sellaisen epäluotettavan lastmodin hakukoneet
 * oppivat ohittamaan. Parempi jättää pois kuin antaa väärää tietoa. */
function url(loc, priority, changefreq) {
  return [
    "  <url>",
    `    <loc>${SITE}${loc}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");
}

function build() {
  const parts = [];

  for (const p of STATIC_PATHS) {
    parts.push(url(p.path, p.priority, p.changefreq));
  }

  /* Paikkasivut: pysyvää, paikkakohtaista sisältöä — pitkän hännän
     hakusanat osuvat juuri näihin. */
  for (const slug of readPlaceSlugs()) {
    parts.push(url(`/places/${slug}`, "0.8", "daily"));
  }

  for (const slug of BLOG_SLUGS) {
    parts.push(url(`/blog/${slug}`, "0.6", "monthly"));
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    parts.join("\n") +
    "\n</urlset>\n";

  const out = path.join(__dirname, "..", "..", "public", "sitemap.xml");
  fs.writeFileSync(out, xml, "utf8");

  const count = parts.length;
  console.log(`✓ sitemap.xml generoitu — ${count} osoitetta`);
}

build();