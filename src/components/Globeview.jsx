import { useEffect, useRef, useState, Suspense, lazy, useCallback, useMemo } from "react";
import useTranslation from "../hooks/useTranslation";
import staticPlaces from "../data/places";
import AuroraPopup from "./AuroraPopup";

const Globe = lazy(() => import("react-globe.gl"));

const OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
// KORJAUS: vanhat URLit olivat rikki (404 / väärä formaatti) -> koko Promise.all
// kaatui eikä rajoja tai kaupunkeja koskaan asetettu. Nämä Natural Earth
// -aineistot ovat samoja, joita react-globe.gl:n omat esimerkit käyttävät.
const BORDERS_URL = "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";
const CITIES_URL = "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_populated_places_simple.geojson";

const LOAD_TIMEOUT_MS = 15000;

const BASE = process.env.REACT_APP_API_BASE || "";
const DEFAULT_CALC_POINT = { lat: 66.5, lng: 26.0 }; // Lappi — HUD:n oletusarvot

function readDeviceKey() {
  try {
    const p = JSON.parse(localStorage.getItem("aurora_premium") || "null");
    if (!p || !p.deviceKey || !p.expiresAt) return "";
    if (p.expiresAt < Date.now()) return "";
    return p.deviceKey;
  } catch {
    return "";
  }
}

/* Kerrosvalinnat — talteen localStorageen */
const LAYERS_KEY = "globe_layers_v1";
const DEFAULT_LAYERS = { aurora: true, borders: true, cities: true, places: true };

function readLayers() {
  try {
    return { ...DEFAULT_LAYERS, ...JSON.parse(localStorage.getItem(LAYERS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_LAYERS };
  }
}

/* ---- Sessiovälimuisti + datan lataajat ----
 * Prosessoitu data talteen sessionStorageen → sivun avaus ja
 * uudelleenkäynnit eivät hae/parsi isoja JSONeja uudelleen. */
function cacheRead(key, ttlMs) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || typeof c.savedAt !== "number") return null;
    if (Date.now() - c.savedAt > ttlMs) { sessionStorage.removeItem(key); return null; }
    return c.data ?? null;
  } catch { return null; }
}
function cacheWrite(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch {}
}

async function loadAuroraPoints() {
  const cached = cacheRead("globe:aurora:v1", 10 * 60 * 1000);
  if (cached) return cached;
  const res = await fetch(OVATION_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Aurora data not found.");
  const ovationData = await res.json();
  const coords = ovationData?.coordinates || [];
  const pts = [];
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    const val = c[2];
    if (val >= MIN_AURORA) {
      const lat = c[1];
      if (Math.abs(lat) >= MIN_ABS_LAT) {
        pts.push({ lat, lng: c[0] > 180 ? c[0] - 360 : c[0], val: val / 100 });
      }
    }
  }
  cacheWrite("globe:aurora:v1", pts);
  return pts;
}

async function loadBorders() {
  const cached = cacheRead("globe:borders:v1", 24 * 60 * 60 * 1000);
  if (cached) return cached;
  const res = await fetch(BORDERS_URL);
  if (!res.ok) throw new Error("Country borders data not found.");
  const geo = await res.json();
  const features = geo.features || [];
  cacheWrite("globe:borders:v1", features);
  return features;
}

async function loadCities() {
  const cached = cacheRead("globe:cities:v1", 24 * 60 * 60 * 1000);
  if (cached) return cached;
  const res = await fetch(CITIES_URL);
  if (!res.ok) throw new Error("Major cities data not found.");
  const geo = await res.json();
  const majorCities = (geo.features || [])
    .filter(f => (f.properties.pop_max || 0) > MIN_CITY_POP)
    .map(f => ({
      lat: f.properties.latitude ?? f.geometry.coordinates[1],
      lng: f.properties.longitude ?? f.geometry.coordinates[0],
      name: f.properties.name,
      // three-globen label-fontti ei sisällä ø/å/ü yms. → ASCII näkyviin
      nameAscii: f.properties.nameascii || f.properties.name,
      country: f.properties.adm0name,
      population: f.properties.pop_max
    }));
  cacheWrite("globe:cities:v1", majorCities);
  return majorCities;
}

/* ENNAKKOLATAUS: kutsu tätä esim. etusivulta selaimen idle-aikana,
 * niin map-sivu aukeaa ilman yhtään verkkohakua:
 *
 *   useEffect(() => {
 *     const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
 *     idle(() => import("./components/GlobeView").then((m) => m.preloadGlobeAssets()));
 *   }, []);
 */
export async function preloadGlobeAssets() {
  try { import("react-globe.gl"); } catch {} // lämmittää koodipaketin
  await Promise.allSettled([loadAuroraPoints(), loadBorders(), loadCities()]);
}

/* Pieni mittaribadge (inline-tyylit → ei CSS-riippuvuutta) */
function HudBadge({ label, value }) {
  return (
    <span style={{
      background: "rgba(8, 14, 26, 0.72)",
      border: "1px solid rgba(0, 255, 198, 0.25)",
      borderRadius: 999,
      padding: "4px 10px",
      fontSize: 12,
      color: "#e6e9ef",
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {label} <span style={{ color: "#00ffc6" }}>{value}</span>
    </span>
  );
}

// Matala raja, jotta koko ovaali (myös himmeät reunat) pääsee heatmappiin.
// Näkyvyys säädetään väriskaalan alphalla, ei datan suodatuksella.
const MIN_AURORA = 3;
const MIN_ABS_LAT = 45;

const MIN_CITY_POP = 1000000; // näytettävien kaupunkien minimiväkiluku

function deviceCanRenderGlobe() {
  if (typeof window === "undefined") return false;
  const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (rm && rm.matches) return false;
  const c = navigator.connection || navigator.webkitConnection || {};
  if (c.saveData) return false;
  if (c.effectiveType && !/4g/i.test(c.effectiveType)) return false;
  const cores = navigator.hardwareConcurrency;
  if (cores && cores < 4) return false;
  const mem = navigator.deviceMemory;
  if (mem != null && mem < 4) return false;
  try {
    const cv = document.createElement("canvas");
    if (!(cv.getContext("webgl2") || cv.getContext("webgl"))) return false;
  } catch { return false; }
  return true;
}

// NOAA Aurora Forecast -tyylinen väriskaala:
// läpinäkyvä → vihreä (matala) → keltainen (~50 %) → punainen (~90 %).
function getAuroraColor(t) {
  const stops = [
    [0.00, [0, 200, 60, 0]],
    [0.06, [0, 220, 70, 0.30]],
    [0.30, [60, 240, 60, 0.55]],
    [0.55, [160, 255, 40, 0.70]],
    [0.75, [255, 220, 0, 0.82]],
    [1.00, [255, 50, 0, 0.92]]
  ];
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const t0 = stops[i - 1][0], c0 = stops[i - 1][1];
      const t1 = stops[i][0], c1 = stops[i][1];
      const f = (t - t0) / ((t1 - t0) || 1);
      const ch = (k) => Math.round(c0[k] + (c1[k] - c0[k]) * f);
      const a = (c0[3] + (c1[3] - c0[3]) * f);
      return `rgba(${ch(0)},${ch(1)},${ch(2)},${a.toFixed(3)})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgba(${last[0]},${last[1]},${last[2]},${last[3]})`;
}

export default function GlobeView({ premium = false, onFallback, onUpgrade }) {
  const { t } = useTranslation();
  const globeEl = useRef(null);
  const readyRef = useRef(false);

  const [auroraPoints, setAuroraPoints] = useState([]);
  const [countriesBorders, setCountriesBorders] = useState([]);
  const [citiesData, setCitiesData] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const wrapRef = useRef(null);

  /* Klikkauslaskenta — sama data ja popup kuin 2D-kartalla:
     free → /api/aurora/calc (kevyt), premium → /api/aurora/forecast
     (popupin Forecast-välilehti + paras ikkuna tarvitsevat sen).
     Gating pysyy serverillä. */
  const [popupData, setPopupData] = useState(null);
  const [popupError, setPopupError] = useState(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [hud, setHud] = useState(null);            // yläpalkin mittarit

  /* Kerrosten päälle/pois-kytkennät (nopeuttaa myös renderöintiä) */
  const [layers, setLayers] = useState(readLayers);
  const [layersOpen, setLayersOpen] = useState(false);
  const toggleLayer = useCallback((key) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(LAYERS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const [clickPos, setClickPos] = useState(null);  // { lat, lng }
  const [clickLabel, setClickLabel] = useState(null); // paikan nimi jos klikattiin markeria
  const [popupXY, setPopupXY] = useState(null);    // popupin ruutukoordinaatit

  const fetchPoint = useCallback(async (lat, lng) => {
    setPopupLoading(true);
    setPopupError(null);
    const deviceKey = readDeviceKey();
    const endpoint = deviceKey ? "/api/aurora/forecast" : "/api/aurora/calc";
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon: lng, deviceKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPopupData(data);
      // HUD-arvot vastauksesta
      if (data.tier === "premium") {
        setHud({
          tier: "premium",
          kp: data.slots?.[0]?.kp ?? data.kp ?? null,
          bz: data.current?.bz ?? data.bz ?? null,
          speed: data.current?.speed ?? data.speed ?? null,
          density: data.current?.density ?? data.density ?? null,
        });
      } else {
        setHud({ tier: "free", kp: data.kp ?? null });
      }
    } catch (e) {
      console.warn("aurora fetch failed:", e);
      setPopupError(e);
    }
    setPopupLoading(false);
  }, []);

  /* Oletuspisteen arvot HUDiin heti kun komponentti aukeaa */
  useEffect(() => {
    fetchPoint(DEFAULT_CALC_POINT.lat, DEFAULT_CALC_POINT.lng);
  }, [fetchPoint]);

  const handleGlobeClick = useCallback((coords, event, label = null) => {
    if (!coords) return;
    setClickLabel(label);
    setClickPos({ lat: coords.lat, lng: coords.lng });
    setPopupData(null); // popup näyttää lataustilan kunnes uusi data saapuu
    setPopupError(null);
    // Alkuasento suoraan klikkauksesta — seuranta-efekti tarkentaa heti perään
    if (event && event.clientX != null && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPopupXY({ x: event.clientX - r.left, y: event.clientY - r.top });
    }
    fetchPoint(coords.lat, coords.lng);
  }, [fetchPoint]);

  const closePopup = useCallback(() => {
    setClickPos(null);
    setClickLabel(null);
    setPopupXY(null);
  }, []);

  /* Popup seuraa klikattua pistettä joka framella (rAF + suora DOM-päivitys,
     ei React-renderöintiä 60x/s) — pysyy kohdillaan myös zoomatessa */
  const popupRef = useRef(null);
  useEffect(() => {
    if (!clickPos) return;
    let raf;
    const track = () => {
      const g = globeEl.current;
      const el = popupRef.current;
      if (g && el && typeof g.getScreenCoords === "function") {
        const p = g.getScreenCoords(clickPos.lat, clickPos.lng, 0.003);
        if (p) {
          const x = Math.min(Math.max(p.x, 110), Math.max(size.w - 110, 110));
          const y = Math.min(Math.max(p.y, 90), Math.max(size.h - 16, 90));
          el.style.left = `${x}px`;
          el.style.top = `${y - 10}px`;
        }
      }
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    return () => cancelAnimationFrame(raf);
  }, [clickPos, size.w, size.h]);

  /* Paikkamarkerit places.js:stä — klikkaus avaa saman laskentapopupin */
  const placeMarkers = useMemo(() => staticPlaces.map((p) => ({ ...p })), []);

  const makePlaceMarker = useCallback((d) => {
    const el = document.createElement("div");
    el.style.pointerEvents = "auto";
    el.style.cursor = "pointer";
    const inner = document.createElement("div");
    inner.style.cssText = "display:flex;flex-direction:column;align-items:center;transform:translateY(-55%);";
    inner.innerHTML =
      `<div style="background:rgba(8,14,26,0.78);border:1px solid rgba(0,255,198,0.35);border-radius:999px;` +
      `padding:2px 8px;font-size:11px;font-weight:600;color:#e6e9ef;white-space:nowrap;">${d.name}</div>` +
      `<div style="width:8px;height:8px;border-radius:50%;background:#00ffc6;box-shadow:0 0 8px #00ffc6;margin-top:2px;"></div>`;
    el.appendChild(inner);
    el.onclick = (ev) => {
      ev.stopPropagation();
      handleGlobeClick({ lat: d.lat, lng: d.lon }, ev, d.name);
    };
    return el;
  }, [handleGlobeClick]);

  const tr = useCallback((k, d) => {
    const s = t(k);
    return s == null || s === k ? d : s;
  }, [t]);

  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    if (!deviceCanRenderGlobe()) {
      onFallback?.("unsupported");
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (!readyRef.current && !cancelled) onFallback?.("timeout");
    }, LOAD_TIMEOUT_MS);

    // Lataajat lukevat ensin sessiovälimuistista (preloadGlobeAssets on
    // voinut täyttää sen jo etusivulla) — verkkoon mennään vain tarvittaessa.
    Promise.allSettled([loadAuroraPoints(), loadBorders(), loadCities()])
      .then(([auroraRes, bordersRes, citiesRes]) => {
        if (cancelled) return;

        if (auroraRes.status === "fulfilled") setAuroraPoints(auroraRes.value);
        else console.error("Virhe ladattaessa aurora-dataa:", auroraRes.reason);

        if (bordersRes.status === "fulfilled") setCountriesBorders(bordersRes.value);
        else console.error("Virhe ladattaessa rajadataa:", bordersRes.reason);

        if (citiesRes.status === "fulfilled") setCitiesData(citiesRes.value);
        else console.error("Virhe ladattaessa kaupunkidataa:", citiesRes.reason);
      });

    return () => { cancelled = true; clearTimeout(timer); };
  }, [onFallback]);

  const onGlobeReady = useCallback(() => {
    readyRef.current = true;
    const g = globeEl.current;
    if (!g) return;

    const controls = g.controls();
    controls.autoRotate = !premium;
    controls.autoRotateSpeed = 0.5;
    controls.enablePan = false;
    controls.enableZoom = premium;
    controls.enableRotate = premium;
    // Ripeämpi zoomi + pehmeä liike (oletus tuntuu tahmealta tiilikartalla)
    controls.zoomSpeed = 2.2;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    // Rajaa zoomausalue: revontulikartta ei tarvitse katutason tiiliä.
    // Tämä leikkaa tile-lataukset murto-osaan → zoomi reagoi heti.
    // (globen säde = 100 yksikköä; 115 ≈ altitude 0.15, 500 ≈ altitude 4)
    controls.minDistance = 115;
    controls.maxDistance = 500;

    g.pointOfView({ lat: 40, lng: -20, altitude: 2.3 }, 0);
  }, [premium]);

  return (
    <div className="globe-view parannettu-globe" ref={wrapRef} style={{ position: "relative" }}>
      <Suspense fallback={<div className="globe-loading">{tr("globe.loading", "Loading globe…")}</div>}>
        {size.w > 0 && (
          <Globe
            ref={globeEl}
            width={size.w}
            height={size.h}
            rendererConfig={{ powerPreference: "high-performance" }}
            onGlobeReady={onGlobeReady}
            /* Satelliittikarttatiilet (Esri World Imagery) — lataa tarkkuutta
               progressiivisesti zoomin mukaan kuten Google Earth.
               Vaatii react-globe.gl >= 2.31 — jos pallo jää tyhjäksi,
               aja: npm install react-globe.gl@latest
               Kevyt fallback: poista globeTileEngineUrl ja palauta
               globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg" */
            globeTileEngineUrl={(x, y, l) =>
              `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`
            }
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            showAtmosphere={true}
            atmosphereColor="#00e6ff"
            atmosphereAltitude={0.12}
            polygonsData={layers.borders ? countriesBorders : []}
            polygonAltitude={0.005}
            polygonSideColor={() => "rgba(255, 255, 255, 0.1)"}
            polygonCapColor={() => "rgba(0, 0, 0, 0)"}
            polygonStrokeColor={() => "#d4af37"}
            polygonsTransitionDuration={0}
            labelsData={layers.cities ? citiesData : []}
            labelLat="lat"
            labelLng="lng"
            labelText="nameAscii"
            labelLabel={d => `${d.name}, ${d.country}`}
            labelColor={() => "rgba(212, 175, 55, 0.85)"}
            labelAltitude={0.006}
            labelSize={0.5}
            labelDotRadius={0.15}
            labelResolution={2}
            heatmapsData={layers.aurora && auroraPoints.length ? [auroraPoints] : []}
            heatmapPoints={d => d}
            heatmapPointLat="lat"
            heatmapPointLng="lng"
            heatmapPointWeight="val"
            heatmapBandwidth={2.2}
            heatmapColorFn={() => getAuroraColor}
            heatmapColorSaturation={2.8}
            heatmapBaseAltitude={0.012}
            heatmapsTransitionDuration={0}
            labelsTransitionDuration={0}
            onGlobeClick={(coords, e) => handleGlobeClick(coords, e)}
            onPolygonClick={(p, e, coords) => handleGlobeClick(coords, e)}
            onHeatmapClick={(h, e, coords) => handleGlobeClick(coords, e)}
            htmlElementsData={layers.places ? placeMarkers : []}
            htmlLat="lat"
            htmlLng="lon"
            htmlAltitude={0.003}
            htmlElement={makePlaceMarker}
            ringsData={clickPos ? [clickPos] : []}
            ringLat="lat"
            ringLng="lng"
            ringColor={() => "rgba(0, 255, 198, 0.6)"}
            ringMaxRadius={3}
            ringPropagationSpeed={2}
            ringRepeatPeriod={1000}
          />
        )}
      </Suspense>

      {/* Mittaripalkki heti headerin alla: globaalit avaruussääarvot
          pelkkinä numeroina. Free näkee Kp:n, premium myös Bz/tuuli/tiheys
          (arvot tulevat serveriltä, gating siellä). Oikeassa reunassa
          kerrosvalikko, jolla ominaisuuksia saa pois päältä. */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        zIndex: 999, // myös mittaripalkki markerikerroksen yläpuolelle
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 10px",
        overflowX: "auto",
        scrollbarWidth: "none",
        background: "linear-gradient(180deg, rgba(2, 4, 10, 0.75), rgba(2, 4, 10, 0))",
        pointerEvents: "none",
      }}>
        {hud && (
          <>
            <HudBadge label="Kp" value={hud.kp ?? "–"} />
            {hud.tier === "premium" && (
              <>
                <HudBadge label="Bz" value={hud.bz != null ? `${hud.bz} nT` : "–"} />
                <HudBadge label={tr("globe.wind", "Tuuli")} value={hud.speed != null ? `${hud.speed} km/s` : "–"} />
                <HudBadge label={tr("globe.density", "Tiheys")} value={hud.density != null ? `${hud.density} p/cm³` : "–"} />
              </>
            )}
          </>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setLayersOpen((o) => !o)}
          style={{
            pointerEvents: "auto",
            display: "inline-flex", alignItems: "center", gap: 5,
            background: layersOpen ? "rgba(0, 255, 198, 0.15)" : "rgba(8, 14, 26, 0.72)",
            border: "1px solid rgba(0, 255, 198, 0.35)",
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 12, fontWeight: 600,
            color: "#00ffc6",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ☰ {tr("globe.layers", "Kerrokset")}
        </button>
      </div>

      {/* Kerrosvalikko */}
      {layersOpen && (
        <div style={{
          position: "absolute", top: 44, right: 10, zIndex: 1001,
          background: "rgba(7, 12, 28, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 12,
          padding: "10px 12px",
          display: "flex", flexDirection: "column", gap: 8,
          minWidth: 160,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
        }}>
          {[
            ["aurora",  tr("globe.layer.aurora",  "Revontulet")],
            ["borders", tr("globe.layer.borders", "Valtioiden rajat")],
            ["cities",  tr("globe.layer.cities",  "Kaupungit")],
            ["places",  tr("globe.layer.places",  "Paikat")],
          ].map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e6e9ef", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!layers[key]}
                onChange={() => toggleLayer(key)}
                style={{ accentColor: "#00ffc6", width: 15, height: 15 }}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Klikatun pisteen popup — sama AuroraPopup kuin 2D-kartalla,
          kuori jäljittelee Leaflet-popupin ulkoasua (popup.css:n tyylit
          .aurora-popup ym. osuvat sisältöön suoraan) */}
      {clickPos && popupXY && (
        <div ref={popupRef} style={{
          position: "absolute",
          left: popupXY.x,
          top: popupXY.y - 10,
          transform: "translate(-50%, -100%)",
          zIndex: 1000, // three-globen HTML-markerikerroksen yläpuolelle
          pointerEvents: "auto",
        }}>
          <div style={{
            position: "relative",
            borderRadius: 22,
            background: "linear-gradient(180deg, rgba(7,12,28,0.96), rgba(5,8,20,0.98))",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.55), 0 0 40px rgba(0,255,200,0.08)",
            padding: 15,
            overflow: "hidden",
          }}>
            <button
              onClick={closePopup}
              aria-label={tr("globe.close", "Sulje")}
              style={{
                position: "absolute", top: 10, right: 10, zIndex: 2,
                background: "none", border: "none",
                color: "rgba(255,255,255,0.5)", cursor: "pointer",
                fontSize: 18, padding: 0, lineHeight: 1,
              }}
            >
              ✕
            </button>
            {clickLabel && (
              <div style={{
                position: "relative", zIndex: 1,
                fontSize: 13, fontWeight: 700, color: "#e6e9ef",
                margin: "2px 0 6px 5px",
              }}>
                📍 {clickLabel}
              </div>
            )}
            <AuroraPopup
              lat={clickPos.lat}
              lng={clickPos.lng}
              data={popupData}
              error={popupError}
              loading={popupLoading}
              premium={premium}
            />
          </div>
          {/* Nuoli alaspäin kohti pistettä */}
          <div style={{
            width: 17, height: 17,
            background: "rgba(5,8,20,0.98)",
            border: "1px solid rgba(255,255,255,0.08)",
            transform: "rotate(45deg)",
            margin: "-9px auto 0",
          }} />
        </div>
      )}

      {/* Esri-tiilien attribuutio (käyttöehtojen vaatimus) */}
      <div style={{
        position: "absolute", right: 6, bottom: 4, zIndex: 4,
        fontSize: 9, color: "rgba(230, 233, 239, 0.55)",
        background: "rgba(2, 4, 10, 0.45)", padding: "1px 6px", borderRadius: 4,
        pointerEvents: "none",
      }}>
        Imagery © Esri, Maxar, Earthstar Geographics
      </div>

      {!premium && (
        <div className="globe-upsell">
          <div className="globe-upsell-text">
            {tr("globe.upsell", "Explore borders, cities, and the aurora with Premium — rotate & zoom the globe at your leisure.")}
          </div>
          <button className="globe-upsell-btn" onClick={() => onUpgrade?.()}>
            {tr("globe.upsellBtn", "Unlock with Premium")}
          </button>
        </div>
      )}
    </div>
  );
}