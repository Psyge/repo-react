/**
 * exportArticlesForDify.js
 * =========================
 * Kertakäyttöinen skripti, joka hakee KAIKKI blogiartikkelisi Contentfulista
 * ja tallentaa ne yhdeksi siistiksi tekstitiedostoksi, jonka voit ladata
 * suoraan Dify:n Knowledge Base -osioon botin tietopankiksi.
 *
 * EI liity workeriin, EI vaadi Cloudflare-muutoksia — pelkkä paikallinen
 * skripti jonka ajat aina kun haluat päivittää botin tietämyksen uusilla
 * artikkeleilla.
 *
 * KÄYTTÖ:
 *   1. Aja projektisi juuresta (samasta kansiosta missä .env-tiedostosi on):
 *        node scripts/exportArticlesForDify.js
 *   2. Tuloste löytyy: dify-articles-export.txt (samassa kansiossa)
 *   3. Lataa se tiedosto Dify:n Knowledge Base -osioon (Add → Upload file)
 *
 * VAATIMUKSET:
 *   - .env-tiedostossasi (projektin juuressa) on jo olemassa:
 *       REACT_APP_CONTENTFUL_SPACE_ID=...
 *       REACT_APP_CONTENTFUL_ACCESS_TOKEN=...
 *     (samat joita React-appisi jo käyttää — ei tarvitse luoda uusia)
 *   - contentful-paketti on jo asennettuna (on, koska sivustosi käyttää sitä)
 *   - VALINNAINEN: jos artikkelisi käyttävät Contentfulin Rich Text -kenttää
 *     (ei pelkkää tekstikenttää) leipätekstille, asenna lisäksi:
 *       npm install --save-dev @contentful/rich-text-plain-text-renderer
 *     Ilman tätä skripti toimii silti, mutta rich text -kentät näkyvät
 *     tuloksessa raakana JSON:na sen sijaan että ne muunnettaisiin luettavaksi
 *     tekstiksi — skripti kertoo tästä ajon lopussa jos näin käy.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('contentful');

/* ---- Pieni .env-lataaja ilman ulkoista riippuvuutta ----
 * Lukee projektin juuren .env-tiedoston ja asettaa muuttujat
 * process.env:iin, jos niitä ei ole jo asetettu. */
function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    // Poistetaan ympäröivät lainausmerkit jos niitä on
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

// Yritetään ladata rich text -muunnin, jos se on asennettu. Ei pakollinen.
let documentToPlainTextString = null;
try {
  documentToPlainTextString = require('@contentful/rich-text-plain-text-renderer').documentToPlainTextString;
} catch {
  // Ei asennettu — käsitellään myöhemmin fallbackilla.
}

const SPACE_ID = process.env.REACT_APP_CONTENTFUL_SPACE_ID;
const ACCESS_TOKEN = process.env.REACT_APP_CONTENTFUL_ACCESS_TOKEN;

if (!SPACE_ID || !ACCESS_TOKEN) {
  console.error('❌ REACT_APP_CONTENTFUL_SPACE_ID tai REACT_APP_CONTENTFUL_ACCESS_TOKEN puuttuu.');
  console.error('   Varmista että .env-tiedosto löytyy projektin juuresta ja sisältää nämä.');
  process.exit(1);
}

const client = createClient({
  space: SPACE_ID,
  environment: 'master',
  accessToken: ACCESS_TOKEN,
});

/* Muuntaa yhden lokalisoidun kentän arvon luettavaksi tekstiksi.
 * value on muotoa { 'fi-FI': ..., 'en-US': ... } (withAllLocales-haun ansiosta). */
function fieldToText(value, locale) {
  if (!value) return '';
  const raw = value[locale];
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);

  // Rich text -kenttä (Contentfulin dokumenttimuoto)
  if (raw && typeof raw === 'object' && raw.nodeType === 'document') {
    if (documentToPlainTextString) {
      try {
        return documentToPlainTextString(raw);
      } catch {
        return '[RICH TEXT -kentän muunnos epäonnistui]';
      }
    }
    return '[RICH TEXT -kenttä — asenna @contentful/rich-text-plain-text-renderer nähdäksesi sisällön luettavana tekstinä]';
  }

  // Jokin muu rakenne (esim. linkki toiseen entryyn, media-assetti) — ohitetaan
  return '';
}

async function main() {
  console.log('Haetaan artikkeleita Contentfulista...');

  let allItems = [];
  let skip = 0;
  const pageSize = 100;

  // Sivutetaan läpi kaikki artikkelit (Contentful palauttaa max 100 kerralla)
  while (true) {
    const response = await client.withAllLocales.getEntries({
      content_type: 'post',
      limit: pageSize,
      skip,
    });
    allItems = allItems.concat(response.items);
    if (response.items.length < pageSize) break;
    skip += pageSize;
  }

  console.log(`Löytyi ${allItems.length} artikkelia. Muodostetaan tekstitiedosto...`);

  let usedFallbackForRichText = false;
  const blocks = allItems.map((item, idx) => {
    const fields = item.fields;

    const titleFi = fieldToText(fields.title, 'fi-FI');
    const titleEn = fieldToText(fields.title, 'en-US');
    const slugFi = fieldToText(fields.slug, 'fi-FI');
    const excerptFi = fieldToText(fields.excerpt, 'fi-FI');
    const excerptEn = fieldToText(fields.excerpt, 'en-US');

    // Yritetään löytää leipätekstikenttä yleisimmillä nimillä — Contentfulin
    // sisällönmallit vaihtelevat, joten kokeillaan muutamaa tavallista nimeä.
    const bodyFieldNames = ['body', 'content', 'bodyText', 'text', 'articleBody'];
    let bodyFi = '';
    let bodyEn = '';
    for (const name of bodyFieldNames) {
      if (fields[name]) {
        bodyFi = fieldToText(fields[name], 'fi-FI') || bodyFi;
        bodyEn = fieldToText(fields[name], 'en-US') || bodyEn;
      }
    }

    if (bodyFi.includes('RICH TEXT') || bodyEn.includes('RICH TEXT')) {
      usedFallbackForRichText = true;
    }

    return [
      `### ARTIKKELI ${idx + 1}`,
      `Otsikko (FI): ${titleFi || '(ei otsikkoa)'}`,
      titleEn ? `Otsikko (EN): ${titleEn}` : null,
      slugFi ? `URL: /blog/${slugFi}` : null,
      excerptFi ? `Lyhyt kuvaus (FI): ${excerptFi}` : null,
      excerptEn ? `Lyhyt kuvaus (EN): ${excerptEn}` : null,
      '',
      bodyFi ? `Sisältö (FI):\n${bodyFi}` : null,
      bodyEn ? `\nSisältö (EN):\n${bodyEn}` : null,
    ].filter(Boolean).join('\n');
  });

  const output = blocks.join('\n\n' + '='.repeat(60) + '\n\n');

  const outPath = path.resolve(process.cwd(), 'dify-articles-export.txt');
  fs.writeFileSync(outPath, output, 'utf-8');

  console.log(`✅ Valmis! ${allItems.length} artikkelia kirjoitettu tiedostoon:`);
  console.log(`   ${outPath}`);
  console.log('');
  console.log('Lataa tämä tiedosto Dify:ssä: Knowledge → Add → Upload file.');

  if (usedFallbackForRichText && !documentToPlainTextString) {
    console.log('');
    console.log('⚠️  HUOM: osa sisällöstä on Contentfulin Rich Text -muodossa, jota ei');
    console.log('    muunnettu luettavaksi tekstiksi. Asenna tämä ja aja skripti uudelleen:');
    console.log('      npm install --save-dev @contentful/rich-text-plain-text-renderer');
  }
}

main().catch((err) => {
  console.error('❌ Virhe artikkeleiden haussa:', err.message || err);
  process.exit(1);
});