/* ============================================================
 * STAATTISET METATIEDOT REITEILLE
 * ============================================================
 * Ajetaan buildin JÄLKEEN (package.json: "postbuild").
 *
 * MIKSI TÄMÄ ON OLEMASSA
 * Sivusto on Create React App: palvelin lähettää tyhjän index.html:n
 * ja JavaScript täyttää sisällön selaimessa. Sosiaalisen median
 * esikatselurobotit (Facebook, WhatsApp, Telegram, Signal, Discord,
 * Slack, X) eivät aja JavaScriptia, joten ne näkivät joka sivulta
 * saman geneerisen etusivun otsikon. Sama koskee useimpia AI-hakujen
 * robotteja.
 *
 * Tämä kopioi build/index.html:n jokaiselle reitille omaksi
 * tiedostokseen ja kirjoittaa siihen reitin omat metatiedot. Vercel
 * tarjoilee build/faq/index.html osoitteessa /faq automaattisesti.
 *
 * Sovellus toimii kuten ennenkin: jokainen tiedosto on sama
 * React-runko, ja React Router ottaa ohjat heti latauksen jälkeen.
 * SEO.jsx jää hoitamaan otsikot kun käyttäjä siirtyy sivulta toiselle
 * ilman uutta latausta.
 *
 * Otsikot ja kuvaukset tulevat Contentfulista, joten jokainen
 * artikkeli saa OMAN otsikkonsa ja excerptinsä — ei geneeristä
 * yhteistekstiä kuten aiemmassa käsin ylläpidetyssä versiossa.
 * ============================================================ */

const fs = require("fs");
const path = require("path");
const { getRoutes, SITE } = require("./lib/contentfulRoutes");

const IMAGE = `${SITE}/images/hero-bg.jpg`;
const BUILD = path.join(__dirname, "..", "..", "build");

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tagsFor(r) {
  const t = esc(r.title);
  const d = esc(r.desc);
  const canonical = SITE + r.p;

  return [
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${IMAGE}">`,
    `<meta property="og:image:alt" content="${t}">`,
    `<meta property="og:type" content="${r.p.startsWith("/blog/") ? "article" : "website"}">`,
    `<meta property="og:site_name" content="RepoTracker">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${IMAGE}">`,
    r.noindex
      ? `<meta name="robots" content="noindex, nofollow">`
      : `<meta name="robots" content="index, follow">`,
  ].join("\n    ");
}

async function main() {
  const indexPath = path.join(BUILD, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error("✗ build/index.html puuttuu — aja tämä vasta buildin jälkeen");
    process.exit(1);
  }

  const { routes, stats } = await getRoutes();
  const template = fs.readFileSync(indexPath, "utf8");
  let written = 0;

  for (const r of routes) {
    const html = template
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(r.title)}</title>`)
      .replace(
        /<meta\s+name="description"[^>]*>/i,
        `<meta name="description" content="${esc(r.desc)}">`
      )
      .replace("</head>", `    ${tagsFor(r)}\n  </head>`);

    /* Juuri kirjoitetaan suoraan build/index.html:ään, muut omiin
       kansioihinsa muodossa build/<polku>/index.html. */
    const outPath =
      r.p === "/"
        ? indexPath
        : path.join(BUILD, ...r.p.split("/").filter(Boolean), "index.html");

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    written++;
  }

  console.log(
    `✓ metatiedot kirjoitettu ${written} reitille ` +
      `(${stats.posts} artikkelia, ${stats.places} paikkaa)`
  );
}

main().catch((e) => {
  /* Jos Contentful ei vastaa, build on jo valmis ja toimiva —
     metatiedot jäävät vain geneerisiksi. Parempi kuin kaatunut deploy. */
  console.error("✗ metatietojen kirjoitus epäonnistui:", e.message);
  console.error("  Sivusto toimii, mutta metatiedot ovat geneerisiä.");
});