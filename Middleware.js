/* ============================================================
 * VERCEL ROUTING MIDDLEWARE — metatiedot palvelimen puolella
 * ============================================================
 * SIJAINTI: repon JUURI (package.jsonin vieressä), ei src/-kansiossa.
 *
 * ONGELMA JONKA TÄMÄ RATKAISEE
 * Sivusto on Create React App, eli palvelin lähettää tyhjän
 * index.html:n ja JavaScript täyttää sisällön vasta selaimessa.
 * SEO.jsx asettaa otsikot ja Open Graph -tagit react-helmetillä,
 * mutta se tapahtuu selaimessa.
 *
 * Sosiaalisen median esikatselurobotit EIVÄT aja JavaScriptia:
 * Facebook, WhatsApp, Telegram, Signal, Discord, Slack, X. Ne
 * lukevat vain palvelimen lähettämät tavut. Siksi jokainen jaettu
 * linkki näytti samalta geneeriseltä etusivulta riippumatta siitä
 * mikä sivu jaettiin. Sama koskee useimpia AI-hakujen robotteja.
 *
 * Tämä middleware kirjoittaa oikeat tagit HTML:ään ENNEN kuin se
 * lähtee liikkeelle. Skripti index.html:ssä ei olisi auttanut —
 * se on sekin JavaScriptia, eikä ehtisi ajaa ennen kuin robotti on
 * jo poistunut.
 *
 * EI CLOAKINGIA
 * Sama HTML tarjoillaan kaikille, ei erikseen roboteille. Injektoidut
 * tagit ovat täsmälleen ne jotka SEO.jsx asettaisi selaimessa, joten
 * sisältö ei eroa — vain ajoitus. Robottien tunnistaminen
 * user-agentista ja eri sisällön tarjoilu olisi cloakingia ja siitä
 * rangaistaan.
 *
 * SEO.jsx JÄÄ PAIKALLEEN: se hoitaa välilehden otsikon kun käyttäjä
 * siirtyy sivulta toiselle ilman uutta sivulatausta.
 * ============================================================ */

const SITE = "https://repotracker.fi";

/* Oma revontulikuva. Aiemmin tässä oli /images/reposet.png, jota ei
   ole palvelimella lainkaan — se palautti HTML-sivun eikä kuvaa,
   joten esikatseluihin ei olisi tullut kuvaa vaikka tagit toimisivat.

   HUOM KOOSTA: hero-bg.jpg on 3000x2000 px eli 3:2. Esikatselut
   odottavat 1200x630 (1.91:1) ja rajaavat keskeltä — tässä kuvassa
   revontulet ovat keskellä, joten rajaus osuu hyvin. Tiedosto on
   kuitenkin iso, ja osa roboteista ohittaa raskaat kuvat. Kun ehdit,
   tee siitä 1200x630 kokoinen kopio nimellä og-default.jpg ja vaihda
   tämä osoittamaan siihen. */
const DEFAULT_IMAGE = `${SITE}/images/hero-bg.jpg`;

const PLACES = {
  rovaniemi:   "Rovaniemi",
  levi:        "Levi",
  saariselka:  "Saariselkä",
  inari:       "Inari",
  kilpisjarvi: "Kilpisjärvi",
  pallas:      "Pallas",
  utsjoki:     "Utsjoki",
  pyha:        "Pyhä",
  yllas:       "Ylläs",
};

/* Kiinteät sivut. Pidä nämä samoina kuin SEO.jsx:n arvot kullakin
   sivulla — jos ne eroavat, käyttäjä näkee eri otsikon kuin robotti. */
const PAGES = {
  "/": {
    title: "RepoTracker | Northern Lights Forecast Finland",
    description:
      "Live Northern Lights forecast, Kp index, solar wind and aurora map for Finland and Lapland.",
  },
  "/map": {
    title: "Northern Lights Map Finland | RepoTracker",
    description:
      "Explore current northern lights conditions across Finland with RepoTracker's interactive aurora forecast map.",
  },
  "/blog": {
    title: "Northern Lights Articles and Guides | RepoTracker",
    description:
      "Guides for seeing the northern lights in Lapland: best time to go, photography tips, reading the Kp index and what to wear.",
  },
  "/faq": {
    title: "Northern Lights FAQ | RepoTracker",
    description:
      "Everything you need to chase the Northern Lights — from Kp values to what to wear at -25 °C.",
  },
  "/premium": {
    title: "Premium Northern Light Forecast | RepoTracker",
    description:
      "Unlock 72-hour aurora forecasts and advanced northern lights tracking.",
  },
  "/alerts": {
    title: "Aurora Alerts | RepoTracker",
    description:
      "Set up personal aurora alerts via Telegram or email.",
  },
  "/about": {
    title: "About RepoTracker",
    description:
      "RepoTracker is a solo project by a single Northern Lights enthusiast.",
  },
  "/contact": {
    title: "Contact | RepoTracker",
    description: "Questions or feedback about RepoTracker.",
  },
  "/privacy": {
    title: "Privacy Policy | RepoTracker",
    description: "How RepoTracker handles your data.",
  },
  "/terms": {
    title: "Terms of Service | RepoTracker",
    description: "Terms of use for RepoTracker.",
  },
};

/* Sivut joita ei haluta hakutuloksiin. Kuittaussivulla on osoitteessa
   aktivointitunnus, virhesivulla ei ole sisältöä. */
const NOINDEX = new Set(["/premium-success"]);

function metaFor(pathname) {
  // Poista mahdollinen loppukauttaviiva, paitsi juurelta
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (PAGES[p]) return { ...PAGES[p], canonical: SITE + p, noindex: NOINDEX.has(p) };

  const place = p.match(/^\/places\/([a-z0-9-]+)$/i);
  if (place) {
    const name = PLACES[place[1].toLowerCase()];
    if (!name) return null;
    return {
      title: `Northern Lights in ${name} | RepoTracker`,
      description: `Live aurora forecast, cloud cover and Kp index for ${name}, Finnish Lapland.`,
      canonical: `${SITE}/places/${place[1].toLowerCase()}`,
      noindex: false,
    };
  }

  /* Blogiartikkelit tulevat Contentfulista eikä niiden otsikoita voi
     lukea täältä ilman API-kutsua. Annetaan yleinen mutta oikea
     kuvaus — parempi kuin etusivun teksti. */
  if (/^\/blog\/[^/]+$/.test(p)) {
    return {
      title: "Northern Lights Guide | RepoTracker",
      description:
        "A guide to seeing and photographing the northern lights in Finnish Lapland.",
      canonical: SITE + p,
      noindex: false,
    };
  }

  if (NOINDEX.has(p)) {
    return {
      title: "RepoTracker",
      description: "RepoTracker",
      canonical: null,
      noindex: true,
    };
  }

  return null;   // tuntematon polku → annetaan mennä koskematta
}

/* HTML-attribuuttiin menevä teksti pitää escapetä. Nämä ovat omia
   tekstejämme, mutta escape on halpa eikä siihen tarvitse palata
   jos tekstit joskus tulevat muualta. */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTags(m) {
  const t = esc(m.title);
  const d = esc(m.description);
  const img = esc(DEFAULT_IMAGE);

  const tags = [
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:alt" content="${t}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="RepoTracker">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${img}">`,
  ];

  if (m.canonical) {
    tags.push(`<meta property="og:url" content="${esc(m.canonical)}">`);
    tags.push(`<link rel="canonical" href="${esc(m.canonical)}">`);
  }

  tags.push(
    m.noindex
      ? `<meta name="robots" content="noindex, nofollow">`
      : `<meta name="robots" content="index, follow">`
  );

  return tags.join("\n    ");
}

export default async function middleware(request) {
  const url = new URL(request.url);

  /* Vain sivupyynnöt. Kuvat, skriptit ja API-kutsut menevät ohi —
     accept-otsake erottaa selaimen sivunavigaation muusta. */
  const accept = request.headers.get("accept") || "";
  if (!accept.includes("text/html")) return;

  const meta = metaFor(url.pathname);
  if (!meta) return;

  /* Haetaan sovelluksen oma index.html. Tämä EI palaa middlewareen,
     koska matcher jättää pisteen sisältävät polut ulkopuolelle.

     accept-encoding: identity on PAKOLLINEN. Ilman sitä vastaus tulee
     brotli- tai gzip-pakattuna, res.text() tulkitsee pakatut tavut
     tekstinä ja lopputulos on lukukelvotonta roskaa — sivu näytti
     selaimessa rikkinäiseltä. */
  let res;
  try {
    res = await fetch(`${url.origin}/index.html`, {
      headers: {
        "accept": "text/html",
        "accept-encoding": "identity",
      },
    });
  } catch {
    return;   // jos haku epäonnistuu, annetaan alkuperäisen pyynnön mennä
  }
  if (!res.ok) return;

  let html = await res.text();

  /* Järkevyystarkistus ennen kuin mitään tarjoillaan.
   *
   * Jos runko ei näytä HTML:ltä — pakkaus purkamatta, tyhjä vastaus,
   * virhesivu — palataan tyhjin käsin, jolloin pyyntö menee normaalisti
   * läpi ilman injektiota. Metatiedot jäävät silloin geneerisiksi, mikä
   * on huomattavasti parempi kuin rikkinäinen sivu. */
  if (!html || !html.includes("</head>") || !html.includes("<title>")) {
    return;
  }

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`)
    .replace(
      /<meta\s+name="description"[^>]*>/i,
      `<meta name="description" content="${esc(meta.description)}">`
    )
    .replace("</head>", `    ${buildTags(meta)}\n  </head>`);

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      /* Selain ei säilö, mutta Vercelin reuna säilöö 5 min. Sivun
         sisältö on joka tapauksessa dynaamista ja haetaan JS:llä —
         vain metatiedot ovat staattisia polkukohtaisesti. */
      "cache-control": "public, max-age=0, s-maxage=300",
      "x-meta-injected": "1",
    },
  });
}

export const config = {
  /* Ohitetaan Vercelin sisäiset polut ja KAIKKI pisteen sisältävät
     polut. Jälkimmäinen on tärkeä kahdesta syystä: staattiset
     tiedostot menevät suoraan läpi, ja /index.html-haku tämän
     funktion sisällä ei aiheuta ikuista silmukkaa. */
  matcher: ["/((?!_vercel|api/|.*\\.).*)"],
};