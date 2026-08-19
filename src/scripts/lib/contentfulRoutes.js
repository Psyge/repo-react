/* ============================================================
 * REITTIEN HAKU CONTENTFULISTA
 * ============================================================
 * Yhteinen moduuli sitemap- ja metatietoskripteille. Molemmat
 * tarvitsevat saman listan sivuista, ja käsin ylläpidettynä ne
 * ajautuivat väistämättä erilleen — sitemapissa oli kolme
 * artikkelia yhdeksästä ja paikkoja joille ei ollut sisältöä.
 *
 * Contentful on sisällön ainoa totuuden lähde. Kun julkaiset
 * artikkelin tai paikan, seuraava build poimii sen mukaan
 * automaattisesti — eikä listoja tarvitse päivittää missään.
 *
 * VAATII (samat kuin exportArticlesForDify.js):
 *   REACT_APP_CONTENTFUL_SPACE_ID
 *   REACT_APP_CONTENTFUL_ACCESS_TOKEN
 * ============================================================ */

const fs = require("fs");
const path = require("path");
const { createClient } = require("contentful");

const SITE = "https://repotracker.fi";

/* .env-lataaja ilman ulkoista riippuvuutta — sama kuin
   exportArticlesForDify.js:ssä, jotta käytös on yhtenäinen. */
function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/* Lokalisoidun kentän arvo tekstinä. withAllLocales-haku palauttaa
   kentät muodossa { 'fi-FI': ..., 'en-US': ... }.

   Rich text -kenttiä ei muunneta: metatiedoissa tarvitaan vain
   lyhyitä tekstikenttiä (title, slug, excerpt, short), ja niiden
   pitäisi olla tavallisia tekstikenttiä. */
function text(field, locale, fallbackLocale = "fi-FI") {
  if (!field) return "";
  let raw = field[locale];
  if (raw == null) raw = field[fallbackLocale];
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return "";
}

/* Katkaisee kuvauksen hakukoneille sopivaan pituuteen sanan rajalta.
   Google näyttää tyypillisesti 150-160 merkkiä. */
function clamp(s, max = 160) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:—-]$/, "") + "…";
}

async function fetchAll(client, contentType) {
  let items = [];
  let skip = 0;
  const pageSize = 100;
  while (true) {
    const res = await client.withAllLocales.getEntries({
      content_type: contentType,
      limit: pageSize,
      skip,
    });
    items = items.concat(res.items);
    if (res.items.length < pageSize) break;
    skip += pageSize;
  }
  return items;
}

/* Palauttaa listan reittejä muodossa
   { p, title, desc, changefreq, priority, noindex } */
async function getRoutes() {
  loadDotEnv();

  const SPACE_ID = process.env.REACT_APP_CONTENTFUL_SPACE_ID;
  const ACCESS_TOKEN = process.env.REACT_APP_CONTENTFUL_ACCESS_TOKEN;

  if (!SPACE_ID || !ACCESS_TOKEN) {
    throw new Error(
      "Contentful-tunnukset puuttuvat. Tarkista että .env sisältää " +
        "REACT_APP_CONTENTFUL_SPACE_ID ja REACT_APP_CONTENTFUL_ACCESS_TOKEN."
    );
  }

  const client = createClient({
    space: SPACE_ID,
    environment: "master",
    accessToken: ACCESS_TOKEN,
  });

  /* Kiinteät sivut. Nämä eivät ole Contentfulissa, joten ne pysyvät
     tässä — mutta niitä on kiinteä määrä eivätkä ne muutu. Pidä
     tekstit samoina kuin kunkin sivun SEO.jsx-arvot. */
  const routes = [
    { p: "/", title: "RepoTracker | Northern Lights Forecast Finland",
      desc: "Live Northern Lights forecast, Kp index, solar wind and aurora map for Finland and Lapland.",
      changefreq: "hourly", priority: "1.0" },
    { p: "/map", title: "Northern Lights Map Finland | RepoTracker",
      desc: "Explore current northern lights conditions across Finland with RepoTracker's interactive aurora forecast map.",
      changefreq: "hourly", priority: "0.9" },
    { p: "/blog", title: "Northern Lights Articles and Guides | RepoTracker",
      desc: "Guides for seeing the northern lights in Lapland: best time to go, photography tips, reading the Kp index and what to wear.",
      changefreq: "weekly", priority: "0.8" },
    { p: "/faq", title: "Northern Lights FAQ | RepoTracker",
      desc: "Everything you need to chase the Northern Lights — from Kp values to what to wear at -25 °C.",
      changefreq: "monthly", priority: "0.7" },
    { p: "/premium", title: "Premium Northern Light Forecast | RepoTracker",
      desc: "Unlock 72-hour aurora forecasts and advanced northern lights tracking.",
      changefreq: "monthly", priority: "0.7" },
    { p: "/about", title: "About RepoTracker",
      desc: "RepoTracker is a solo project by a single Northern Lights enthusiast.",
      changefreq: "yearly", priority: "0.5" },
    { p: "/contact", title: "Contact | RepoTracker",
      desc: "Questions or feedback about RepoTracker.",
      changefreq: "yearly", priority: "0.4" },
    { p: "/privacy", title: "Privacy Policy | RepoTracker",
      desc: "How RepoTracker handles your data.",
      changefreq: "yearly", priority: "0.3" },
    { p: "/terms", title: "Terms of Service | RepoTracker",
      desc: "Terms of use for RepoTracker.",
      changefreq: "yearly", priority: "0.3" },

    /* Sivut jotka saavat metatiedot mutta EIVÄT päädy sitemappiin:
       hälytysasetukset ei ole sisältöä hakijalle, ja kuittaussivulla
       on osoitteessa aktivointitunnus. */
    { p: "/alerts", title: "Aurora Alerts | RepoTracker",
      desc: "Set up personal aurora alerts via Telegram or email.",
      sitemap: false },
    { p: "/premium-success", title: "Premium activated | RepoTracker",
      desc: "Your Premium access is being activated.",
      sitemap: false, noindex: true },
  ];

  /* ---- Paikat ---- */
  const places = await fetchAll(client, "place");
  let placeCount = 0;

  for (const item of places) {
    const f = item.fields || {};

    /* Slug pienaakkosiksi.
     *
     * Contentfulissa paikkojen slugit ovat isolla alkukirjaimella
     * ("Rovaniemi"), mutta sovelluksen linkit tulevat data/places.js:stä
     * pienellä ("rovaniemi"). Ilman normalisointia metatiedostot
     * kirjoitettiin polkuun build/places/Rovaniemi/, kun käyttäjä menee
     * osoitteeseen /places/rovaniemi — tiedostoa ei löytynyt ja Vercel
     * putosi takaisin juuren index.html:ään.
     *
     * HUOM: artikkelien slugeja EI normalisoida, koska niiden linkit
     * rakennetaan suoraan Contentfulin arvosta. Siellä ei ole toista
     * lähdettä jonka kanssa voisi tulla ristiriita. */
    const slug = text(f.slug, "en-US").toLowerCase();
    if (!slug) continue;

    const name = text(f.name, "en-US") || text(f.title, "en-US") || slug;
    const short = text(f.short, "en-US") || text(f.description, "en-US");

    routes.push({
      p: `/places/${slug}`,
      title: `Northern Lights in ${name} | RepoTracker`,
      desc: short
        ? clamp(short)
        : `Live aurora forecast, cloud cover and Kp index for ${name}, Finnish Lapland.`,
      changefreq: "daily",
      priority: "0.8",
    });
    placeCount++;
  }

  /* ---- Artikkelit ---- */
  const posts = await fetchAll(client, "post");
  let postCount = 0;

  for (const item of posts) {
    const f = item.fields || {};
    const slug = text(f.slug, "en-US");
    if (!slug) continue;

    const title = text(f.title, "en-US") || slug;
    const excerpt = text(f.excerpt, "en-US");

    routes.push({
      p: `/blog/${slug}`,
      /* Oma otsikko jokaiselle artikkelille. Aiemmin kaikki saivat
         saman geneerisen "Northern Lights Guide" -tekstin, koska
         otsikoita ei haettu mistään. */
      title: `${title} | RepoTracker`,
      desc: excerpt
        ? clamp(excerpt)
        : "A guide to seeing and photographing the northern lights in Finnish Lapland.",
      changefreq: "monthly",
      priority: "0.6",
    });
    postCount++;
  }

  return { routes, stats: { places: placeCount, posts: postCount } };
}

module.exports = { getRoutes, SITE };