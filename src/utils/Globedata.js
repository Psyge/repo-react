/* ============================================================
 * globeData.js — globen vakiot, välimuistit ja datan lataajat.
 * Sijainti: src/components/globe/globeData.js
 * ============================================================ */
import { getGlobeQuality } from "./Globemath";

export const BASE = process.env.REACT_APP_API_BASE || "";
export const LOAD_TIMEOUT_MS = 15000;
export const DEFAULT_CALC_POINT = { lat: 66.5, lng: 26.0 };

/* OVATION tulee nyt workerin kautta (/api/aurora/ovation), joka tarjoilee
   sen KV-välimuistista. Suora NOAA-osoite jätetty kommenttiin viitteeksi:
   https://services.swpc.noaa.gov/json/ovation_aurora_latest.json */
const BORDERS_URL = "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";
const CITIES_URL = "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_populated_places_simple.geojson";

export const LAYERS_KEY = "globe_layers_v3";
// Rajat ja paikkapisteet oletuksena päällä (auttavat hahmottamaan
// maantiedettä), kaupunkilabelit ja pilvet valinnaisina.
export const DEFAULT_LAYERS = {
  aurora: true, borders: true, cities: false,
  places: true, clouds: false, night: true,
};

// Satelliittitiilet ovat suurin yksittäinen tahmaisuuden lähde — vain
// eksplisiittisellä propilla.
export const ENABLE_DETAILED_TILES_BY_DEFAULT = false;

/* Live-pilvitekstuuri (päivittyy ~3 h välein, ilmainen, EUMETSAT-dataa).
 * Ladataan vasta kun kerros kytketään päälle valikosta. */
export const CLOUDS_IMG_URL = "https://clouds.matteason.co.uk/images/4096x2048/clouds-alpha.png";

/* Lähizoomin karttatiilet: Carto dark (tiet + kaupunkien nimet, sama tyyli
 * kuin 2D-kartassa). Hystereesi estää vilkkumisen rajakorkeudella. */
export const CLOSEUP_ENTER_ALT = 0.50;
export const CLOSEUP_EXIT_ALT  = 0.62;
export const CARTO_TILE_URL = (x, y, l) => `https://basemaps.cartocdn.com/dark_all/${l}/${x}/${y}.png`;
export const ESRI_TILE_URL  = (x, y, l) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`;

/* Paikkojen nimilaput vasta lähempää — kaukaa vain pisteet */
export const PLACE_NAMES_ENTER_ALT = 1.0;
export const PLACE_NAMES_EXIT_ALT  = 1.15;

const MIN_AURORA = 3;
const MIN_ABS_LAT = 45;
const MIN_CITY_POP = 1000000;
const MAX_CITY_LABELS = 50;
const BORDER_COUNTRIES = new Set(["Finland", "Suomi", "FIN"]);

let memoryAurora = null;
let memoryBorders = null;
let memoryCities = null;

export function readDeviceKey() {
  try {
    const p = JSON.parse(localStorage.getItem("aurora_premium") || "null");
    if (!p || !p.deviceKey || !p.expiresAt) return "";
    if (p.expiresAt < Date.now()) return "";
    return p.deviceKey;
  } catch {
    return "";
  }
}

export function readLayers() {
  try {
    return { ...DEFAULT_LAYERS, ...JSON.parse(localStorage.getItem(LAYERS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_LAYERS };
  }
}

export function requestIdle(fn) {
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    return window.requestIdleCallback(fn, { timeout: 1200 });
  }
  return setTimeout(fn, 250);
}

export function cancelIdle(id) {
  if (typeof window !== "undefined" && window.cancelIdleCallback) window.cancelIdleCallback(id);
  else clearTimeout(id);
}

function cacheRead(key, ttlMs) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || typeof c.savedAt !== "number") return null;
    if (Date.now() - c.savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return c.data ?? null;
  } catch {
    return null;
  }
}

function cacheWrite(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch {}
}

export async function loadAuroraPoints() {
  if (memoryAurora) return memoryAurora;
  const cached = cacheRead("globe:aurora:v2", 10 * 60 * 1000);
  if (cached) {
    memoryAurora = cached;
    return cached;
  }

  const quality = getGlobeQuality();
  const step = quality === "low" ? 3 : 2;

  /* Haetaan omalta workerilta, EI suoraan NOAA:lta. Suorat selainpyynnöt
     saivat NOAA:n edgen rajoittamaan liikennettä, jolloin kartta jäi
     tyhjäksi. Worker päivittää KV-välimuistin cronilla. */
  const res = await fetch(`${BASE}/api/aurora/ovation`);
  if (!res.ok) throw new Error("Aurora data not found.");
  const ovationData = await res.json();
  const coords = ovationData?.coordinates || [];
  const pts = [];

  for (let i = 0; i < coords.length; i += step) {
    const c = coords[i];
    const val = c[2];
    if (val >= MIN_AURORA) {
      const lat = c[1];
      if (Math.abs(lat) >= MIN_ABS_LAT) {
        pts.push({ lat, lng: c[0] > 180 ? c[0] - 360 : c[0], val: val / 100 });
      }
    }
  }

  memoryAurora = pts;
  cacheWrite("globe:aurora:v2", pts);
  return pts;
}

export async function loadBorders() {
  if (memoryBorders) return memoryBorders;
  const cached = cacheRead("globe:borders:v3", 24 * 60 * 60 * 1000);
  if (cached) {
    memoryBorders = cached;
    return cached;
  }

  const res = await fetch(BORDERS_URL);
  if (!res.ok) throw new Error("Country borders data not found.");
  const geo = await res.json();
  const features = (geo.features || []).filter((feature) => {
    const props = feature.properties || {};
    return BORDER_COUNTRIES.has(props.ADMIN) ||
      BORDER_COUNTRIES.has(props.NAME) ||
      BORDER_COUNTRIES.has(props.NAME_EN) ||
      BORDER_COUNTRIES.has(props.SOVEREIGNT) ||
      BORDER_COUNTRIES.has(props.ISO_A3);
  });
  memoryBorders = features;
  cacheWrite("globe:borders:v3", features);
  return features;
}

export async function loadCities() {
  if (memoryCities) return memoryCities;
  const cached = cacheRead("globe:cities:v2", 24 * 60 * 60 * 1000);
  if (cached) {
    memoryCities = cached;
    return cached;
  }

  const res = await fetch(CITIES_URL);
  if (!res.ok) throw new Error("Major cities data not found.");
  const geo = await res.json();
  const cities = (geo.features || [])
    .filter(f => (f.properties.pop_max || 0) > MIN_CITY_POP)
    .sort((a, b) => (b.properties.pop_max || 0) - (a.properties.pop_max || 0))
    .slice(0, MAX_CITY_LABELS)
    .map(f => ({
      lat: f.properties.latitude ?? f.geometry.coordinates[1],
      lng: f.properties.longitude ?? f.geometry.coordinates[0],
      name: f.properties.name,
      nameAscii: f.properties.nameascii || f.properties.name,
      country: f.properties.adm0name,
      population: f.properties.pop_max
    }));

  memoryCities = cities;
  cacheWrite("globe:cities:v2", cities);
  return cities;
}

/* Kutsutaan esim. etusivulta idle-aikana → map-sivu aukeaa ilman latauksia */
export async function preloadGlobeAssets() {
  await Promise.allSettled([
    import("react-globe.gl"),
    loadAuroraPoints(),
    loadBorders(),
    loadCities(),
  ]);
}