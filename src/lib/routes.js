/* ============================================================
 * Sivuston julkiset polut — yksi totuuden lähde
 * ============================================================
 * Käytetään kahteen asiaan:
 *
 *  1. AI-avustajan linkkien tarkistus. Dify-agentti tuottaa vastauksiinsa
 *     Markdown-linkkejä muodossa [teksti](/polku). Agentti voi hallusinoida
 *     polun jota ei ole olemassa (esim. /forecast tai /kartta), ja koska
 *     linkki on react-routerin sisäinen navigaatio, käyttäjä päätyisi
 *     tyhjälle sivulle ilman mitään virheilmoitusta. Tuntematon polku
 *     renderöidään siksi pelkkänä tekstinä — hallusinaatio näkyy
 *     korkeintaan ylimääräisenä sanana, ei rikkinäisenä linkkinä.
 *
 *  2. Muistilistana kun App.js:ään lisätään reittejä. Jos lisäät reitin
 *     jonne botin on tarkoitus voida ohjata, lisää se myös tänne JA
 *     Dify-agentin ohjeeseen — muuten linkki suodattuu pois.
 * ============================================================ */

/* Tarkat polut */
export const STATIC_PATHS = [
  '/',
  '/map',
  '/blog',
  '/faq',
  '/privacy',
  '/terms',
  '/premium',
  '/premium-success',
  '/contact',
  '/about',
  '/alerts',
];

/* Polut joilla on parametri: /blog/jokin-slug, /places/levi */
export const DYNAMIC_PREFIXES = ['/blog/', '/places/'];

/**
 * Kelpaako sisäinen polku navigoitavaksi?
 * Hyväksyy myös query-parametrit, koska botti ohjaa kartalle muodossa
 * /map?lat=67.9&lon=24.1 — MapPage lukee ne ja keskittää kartan.
 */
export function isKnownPath(url) {
  if (typeof url !== 'string' || !url.startsWith('/')) return false;

  // Erota polku query- ja hash-osista ennen vertailua
  const path = url.split(/[?#]/)[0];

  if (STATIC_PATHS.includes(path)) return true;

  return DYNAMIC_PREFIXES.some(
    (prefix) => path.startsWith(prefix) && path.length > prefix.length
  );
}
