/* ============================================================
 * STAATTISET METATIEDOT REITEILLE
 * ============================================================
 * Ajetaan buildin JÄLKEEN (package.json: "postbuild").
 *
 * MIKSI NÄIN EIKÄ MIDDLEWARELLA
 * Sivusto on Create React App: palvelin lähettää tyhjän
 * index.html:n ja JavaScript täyttää sisällön selaimessa. Sosiaalisen
 * median esikatselurobotit (Facebook, WhatsApp, Telegram, Signal,
 * Discord, Slack, X) eivät aja JavaScriptia, joten ne näkivät joka
 * sivulta saman geneerisen etusivun otsikon.
 *
 * Ensin tämä yritettiin ratkaista Vercelin middlewarella, joka olisi
 * kirjoittanut tagit ajonaikaisesti. Se joutui hakemaan oman
 * index.html:nsä uudelleen HTTP:n yli, ja vastaus hajosi matkalla.
 * Ajonaikainen ratkaisu oli väärä työkalu ongelmaan joka on
 * luonteeltaan staattinen: index.html muuttuu vain buildissa.
 *
 * MITÄ TÄMÄ TEKEE
 * Kopioi build/index.html jokaiselle reitille omaksi tiedostokseen ja
 * kirjoittaa siihen reitin omat metatiedot. Vercel tarjoilee
 * build/faq/index.html osoitteessa /faq automaattisesti.
 *
 * Sovellus toimii täsmälleen kuten ennenkin: jokainen tiedosto on sama
 * React-runko, ja React Router ottaa ohjat heti latauksen jälkeen.
 * SEO.jsx jää paikalleen hoitamaan otsikot kun käyttäjä siirtyy
 * sivulta toiselle ilman uutta latausta.
 * ============================================================ */

const fs = require("fs");
const path = require("path");

const SITE = "https://repotracker.fi";
const IMAGE = `${SITE}/images/hero-bg.jpg`;

const BUILD = path.join(__dirname, "..", "..", "build");

const PLACES = {
  rovaniemi: "Rovaniemi",
  levi: "Levi",
  saariselka: "Saariselkä",
  inari: "Inari",
  kilpisjarvi: "Kilpisjärvi",
  pallas: "Pallas",
  utsjoki: "Utsjoki",
  pyha: "Pyhä",
  yllas: "Ylläs",
};

const BLOG_SLUGS = ["photography", "forecast", "best-time"];

/* Pidä nämä samoina kuin kunkin sivun SEO.jsx-arvot. Jos ne eroavat,
   robotti näkee eri otsikon kuin käyttäjä selaimessa. */
const ROUTES = [
  {
    p: "/",
    title: "RepoTracker | Northern Lights Forecast Finland",
    desc: "Live Northern Lights forecast, Kp index, solar wind and aurora map for Finland and Lapland.",
  },
  {
    p: "/map",
    title: "Northern Lights Map Finland | RepoTracker",
    desc: "Explore current northern lights conditions across Finland with RepoTracker's interactive aurora forecast map.",
  },
  {
    p: "/blog",
    title: "Northern Lights Articles and Guides | RepoTracker",
    desc: "Guides for seeing the northern lights in Lapland: best time to go, photography tips, reading the Kp index and what to wear.",
  },
  {
    p: "/faq",
    title: "Northern Lights FAQ | RepoTracker",
    desc: "Everything you need to chase the Northern Lights — from Kp values to what to wear at -25 °C.",
  },
  {
    p: "/premium",
    title: "Premium Northern Light Forecast | RepoTracker",
    desc: "Unlock 72-hour aurora forecasts and advanced northern lights tracking.",
  },
  {
    p: "/alerts",
    title: "Aurora Alerts | RepoTracker",
    desc: "Set up personal aurora alerts via Telegram or email.",
  },
  {
    p: "/about",
    title: "About RepoTracker",
    desc: "RepoTracker is a solo project by a single Northern Lights enthusiast.",
  },
  {
    p: "/contact",
    title: "Contact | RepoTracker",
    desc: "Questions or feedback about RepoTracker.",
  },
  {
    p: "/privacy",
    title: "Privacy Policy | RepoTracker",
    desc: "How RepoTracker handles your data.",
  },
  {
    p: "/terms",
    title: "Terms of Service | RepoTracker",
    desc: "Terms of use for RepoTracker.",
  },
  {
    p: "/premium-success",
    title: "Premium activated | RepoTracker",
    desc: "Your Premium access is being activated.",
    noindex: true,
  },
];

for (const [slug, name] of Object.entries(PLACES)) {
  ROUTES.push({
    p: `/places/${slug}`,
    title: `Northern Lights in ${name} | RepoTracker`,
    desc: `Live aurora forecast, cloud cover and Kp index for ${name}, Finnish Lapland.`,
  });
}

for (const slug of BLOG_SLUGS) {
  ROUTES.push({
    p: `/blog/${slug}`,
    title: "Northern Lights Guide | RepoTracker",
    desc: "A guide to seeing and photographing the northern lights in Finnish Lapland.",
  });
}

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
  const canonical = SITE + (r.p === "/" ? "/" : r.p);

  const tags = [
    `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${IMAGE}">`,
    `<meta property="og:image:alt" content="${t}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="RepoTracker">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${IMAGE}">`,
    r.noindex
      ? `<meta name="robots" content="noindex, nofollow">`
      : `<meta name="robots" content="index, follow">`,
  ];

  return tags.join("\n    ");
}

function main() {
  const indexPath = path.join(BUILD, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error("✗ build/index.html puuttuu — aja tämä vasta buildin jälkeen");
    process.exit(1);
  }

  const template = fs.readFileSync(indexPath, "utf8");
  let written = 0;

  for (const r of ROUTES) {
    let html = template
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(r.title)}</title>`)
      .replace(
        /<meta\s+name="description"[^>]*>/i,
        `<meta name="description" content="${esc(r.desc)}">`
      )
      .replace("</head>", `    ${tagsFor(r)}\n  </head>`);

    /* Juuri kirjoitetaan suoraan build/index.html:ään, muut omiin
       kansioihinsa muodossa build/<polku>/index.html — Vercel
       tarjoilee ne automaattisesti oikeissa osoitteissa. */
    const outPath =
      r.p === "/"
        ? indexPath
        : path.join(BUILD, ...r.p.split("/").filter(Boolean), "index.html");

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    written++;
  }

  console.log(`✓ metatiedot kirjoitettu ${written} reitille`);
}

main();