import { useEffect, useRef, useState, Suspense, lazy, useCallback, useMemo } from "react";
import useTranslation from "../hooks/useTranslation";
import staticPlaces from "../data/places";
import AuroraPopup from "./AuroraPopup";

const Globe = lazy(() => import("react-globe.gl"));

const OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
const BORDERS_URL = "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";
const CITIES_URL = "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_populated_places_simple.geojson";

const LOAD_TIMEOUT_MS = 15000;
const BASE = process.env.REACT_APP_API_BASE || "";
const DEFAULT_CALC_POINT = { lat: 66.5, lng: 26.0 };

const LAYERS_KEY = "globe_layers_v2";
const DEFAULT_LAYERS = { aurora: true, borders: false, cities: false, places: false };
// Satelliittitiilet ovat suurin yksittäinen tahmaisuuden lähde. Pidetään ne
// oletuksena pois päältä ja sallitaan vain eksplisiittisellä propilla.
const ENABLE_DETAILED_TILES_BY_DEFAULT = false;
const MIN_AURORA = 3;
const MIN_ABS_LAT = 45;
const MIN_CITY_POP = 1000000;
const MAX_CITY_LABELS = 50;

const polygonSideColor = () => "rgba(255, 255, 255, 0.1)";
const polygonCapColor = () => "rgba(0, 0, 0, 0)";
const polygonStrokeColor = () => "#d4af37";
const labelColor = () => "rgba(212, 175, 55, 0.85)";
const heatmapPointsAccessor = d => d;
const ringColor = () => "rgba(0, 255, 198, 0.6)";
const pointColor = () => "#00ffc6";

let memoryAurora = null;
let memoryBorders = null;
let memoryCities = null;

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

function readLayers() {
  try {
    return { ...DEFAULT_LAYERS, ...JSON.parse(localStorage.getItem(LAYERS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_LAYERS };
  }
}

function requestIdle(fn) {
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    return window.requestIdleCallback(fn, { timeout: 1200 });
  }
  return setTimeout(fn, 250);
}

function cancelIdle(id) {
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

function getGlobeQuality() {
  if (typeof window === "undefined") return "low";
  const c = navigator.connection || navigator.webkitConnection || {};
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (c.saveData) return "low";
  if (c.effectiveType && !/4g/i.test(c.effectiveType)) return "low";
  if (cores < 6 || mem < 6) return "low";
  return "high";
}

async function loadAuroraPoints() {
  if (memoryAurora) return memoryAurora;
  const cached = cacheRead("globe:aurora:v2", 10 * 60 * 1000);
  if (cached) {
    memoryAurora = cached;
    return cached;
  }

  const quality = getGlobeQuality();
  const step = quality === "low" ? 3 : 2;
  const res = await fetch(OVATION_URL, { cache: "no-store" });
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

async function loadBorders() {
  if (memoryBorders) return memoryBorders;
  const cached = cacheRead("globe:borders:v2", 24 * 60 * 60 * 1000);
  if (cached) {
    memoryBorders = cached;
    return cached;
  }

  const res = await fetch(BORDERS_URL);
  if (!res.ok) throw new Error("Country borders data not found.");
  const geo = await res.json();
  const features = geo.features || [];
  memoryBorders = features;
  cacheWrite("globe:borders:v2", features);
  return features;
}

async function loadCities() {
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

export async function preloadGlobeAssets() {
  await Promise.allSettled([
    import("react-globe.gl"),
    loadAuroraPoints(),
    loadBorders(),
    loadCities(),
  ]);
}

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
  } catch {
    return false;
  }
  return true;
}

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
      const a = c0[3] + (c1[3] - c0[3]) * f;
      return `rgba(${ch(0)},${ch(1)},${ch(2)},${a.toFixed(3)})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgba(${last[0]},${last[1]},${last[2]},${last[3]})`;
}

function HudBadge({ label, value }) {
  return (
    <span style={{
      background: "rgba(8, 14, 26, 0.72)", border: "1px solid rgba(0, 255, 198, 0.25)",
      borderRadius: 999, padding: "4px 10px", fontSize: 12, color: "#e6e9ef",
      fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {label} <span style={{ color: "#00ffc6" }}>{value}</span>
    </span>
  );
}

export default function GlobeView({ premium = false, onFallback, onUpgrade, detailedGlobe = ENABLE_DETAILED_TILES_BY_DEFAULT }) {
  const { t } = useTranslation();
  const globeEl = useRef(null);
  const readyRef = useRef(false);
  const wrapRef = useRef(null);
  const popupRef = useRef(null);

  const [quality] = useState(getGlobeQuality);
  const [auroraPoints, setAuroraPoints] = useState([]);
  const [countriesBorders, setCountriesBorders] = useState([]);
  const [citiesData, setCitiesData] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [popupData, setPopupData] = useState(null);
  const [popupError, setPopupError] = useState(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [hud, setHud] = useState(null);
  const [layers, setLayers] = useState(readLayers);
  const [layersOpen, setLayersOpen] = useState(false);
  const [clickPos, setClickPos] = useState(null);
  const [clickLabel, setClickLabel] = useState(null);
  const [popupXY, setPopupXY] = useState(null);

  const tr = useCallback((k, d) => {
    const s = t(k);
    return s == null || s === k ? d : s;
  }, [t]);

  const useDetailedTiles = Boolean(detailedGlobe && premium && quality === "high");
  const placeMarkers = useMemo(() => staticPlaces, []);
  const labelLabel = useCallback((d) => `${d.name}, ${d.country}`, []);

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(LAYERS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
      setHud(data.tier === "premium"
        ? {
            tier: "premium",
            kp: data.slots?.[0]?.kp ?? data.kp ?? null,
            bz: data.current?.bz ?? data.bz ?? null,
            speed: data.current?.speed ?? data.speed ?? null,
            density: data.current?.density ?? data.density ?? null,
          }
        : { tier: "free", kp: data.kp ?? null });
    } catch (e) {
      console.warn("aurora fetch failed:", e);
      setPopupError(e);
    } finally {
      setPopupLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoint(DEFAULT_CALC_POINT.lat, DEFAULT_CALC_POINT.lng);
  }, [fetchPoint]);

  const handleGlobeClick = useCallback((coords, event, label = null) => {
    if (!coords) return;
    setClickLabel(label);
    setClickPos({ lat: coords.lat, lng: coords.lng });
    setPopupData(null);
    setPopupError(null);
    if (event && event.clientX != null && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPopupXY({ x: event.clientX - r.left, y: event.clientY - r.top });
    } else {
      setPopupXY({ x: size.w / 2, y: size.h / 2 });
    }
    fetchPoint(coords.lat, coords.lng);
  }, [fetchPoint, size.h, size.w]);

  const onGlobeClick = useCallback((coords, e) => handleGlobeClick(coords, e), [handleGlobeClick]);
  const onPolygonClick = useCallback((p, e, coords) => handleGlobeClick(coords, e), [handleGlobeClick]);
  const onHeatmapClick = useCallback((h, e, coords) => handleGlobeClick(coords, e), [handleGlobeClick]);

  const closePopup = useCallback(() => {
    setClickPos(null);
    setClickLabel(null);
    setPopupXY(null);
  }, []);

  useEffect(() => {
    if (!clickPos) return;
    let raf;
    let last = 0;
    const track = (now) => {
      if (now - last > 50) {
        last = now;
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
      }
      raf = requestAnimationFrame(track);
    };
    raf = requestAnimationFrame(track);
    return () => cancelAnimationFrame(raf);
  }, [clickPos, size.w, size.h]);

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
    const idleIds = [];
    const timer = setTimeout(() => {
      if (!readyRef.current && !cancelled) onFallback?.("timeout");
    }, LOAD_TIMEOUT_MS);

    loadAuroraPoints()
      .then((pts) => { if (!cancelled) setAuroraPoints(pts); })
      .catch((e) => console.error("Virhe ladattaessa aurora-dataa:", e));

    idleIds.push(requestIdle(() => {
      loadBorders()
        .then((features) => { if (!cancelled) setCountriesBorders(features); })
        .catch((e) => console.error("Virhe ladattaessa rajadataa:", e));
    }));

    idleIds.push(requestIdle(() => {
      loadCities()
        .then((cities) => { if (!cancelled) setCitiesData(cities); })
        .catch((e) => console.error("Virhe ladattaessa kaupunkidataa:", e));
    }));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      idleIds.forEach(cancelIdle);
    };
  }, [onFallback]);

  const onGlobeReady = useCallback(() => {
    readyRef.current = true;
    const g = globeEl.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.25;
    controls.enablePan = false;
    controls.enableZoom = premium;
    controls.enableRotate = premium;
    controls.zoomSpeed = 2.0;
    controls.enableDamping = true;
    controls.dampingFactor = 0.10;
    controls.minDistance = 125;
    controls.maxDistance = 500;
    g.pointOfView({ lat: 40, lng: -20, altitude: 2.3 }, 0);
    // Ei automaattipyöritystä oletuksena: jatkuva kameraliike pitää WebGL:n,
    // heatmapin ja mahdolliset tekstuurilataukset aktiivisina koko ajan.
  }, [premium]);

  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = false;
    controls.enableZoom = premium;
    controls.enableRotate = premium;
  }, [premium]);

  return (
    <div className="globe-view parannettu-globe" ref={wrapRef} style={{ position: "relative" }}>
      <Suspense fallback={<div className="globe-loading">{tr("globe.loading", "Loading globe…")}</div>}>
        {size.w > 0 && (
          <Globe
            ref={globeEl}
            width={size.w}
            height={size.h}
            rendererConfig={{ powerPreference: quality === "high" ? "high-performance" : "default" }}
            onGlobeReady={onGlobeReady}
            {...(useDetailedTiles ? {
              globeTileEngineUrl: (x, y, l) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`,
            } : {
              globeImageUrl: "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
              bumpImageUrl: "//unpkg.com/three-globe/example/img/earth-topology.png",
            })}
            backgroundColor="rgba(0,0,0,0)"
            showAtmosphere={quality === "high"}
            atmosphereColor="#00e6ff"
            atmosphereAltitude={0.12}
            polygonsData={layers.borders ? countriesBorders : []}
            polygonAltitude={0.005}
            polygonSideColor={polygonSideColor}
            polygonCapColor={polygonCapColor}
            polygonStrokeColor={polygonStrokeColor}
            polygonsTransitionDuration={0}
            labelsData={layers.cities ? citiesData : []}
            labelLat="lat"
            labelLng="lng"
            labelText="nameAscii"
            labelLabel={labelLabel}
            labelColor={labelColor}
            labelAltitude={0.006}
            labelSize={0.5}
            labelDotRadius={0.15}
            labelResolution={2}
            heatmapsData={layers.aurora && auroraPoints.length ? [auroraPoints] : []}
            heatmapPoints={heatmapPointsAccessor}
            heatmapPointLat="lat"
            heatmapPointLng="lng"
            heatmapPointWeight="val"
            heatmapBandwidth={quality === "low" ? 1.4 : 1.7}
            heatmapColorFn={() => getAuroraColor}
            heatmapColorSaturation={2.6}
            heatmapBaseAltitude={0.012}
            heatmapsTransitionDuration={0}
            labelsTransitionDuration={0}
            onGlobeClick={onGlobeClick}
            onPolygonClick={onPolygonClick}
            onHeatmapClick={onHeatmapClick}
            pointsData={layers.places ? placeMarkers : []}
            pointLat="lat"
            pointLng="lon"
            pointColor={pointColor}
            pointRadius={0.18}
            pointAltitude={0.004}
            pointLabel={(d) => d.name}
            onPointClick={(d, e) => handleGlobeClick({ lat: d.lat, lng: d.lon }, e, d.name)}
            ringsData={clickPos ? [clickPos] : []}
            ringLat="lat"
            ringLng="lng"
            ringColor={ringColor}
            ringMaxRadius={3}
            ringPropagationSpeed={2}
            ringRepeatPeriod={1000}
          />
        )}
      </Suspense>

      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 999,
        display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
        overflowX: "auto", scrollbarWidth: "none",
        background: "linear-gradient(180deg, rgba(2, 4, 10, 0.75), rgba(2, 4, 10, 0))",
        pointerEvents: "none",
      }}>
        {hud && <>
          <HudBadge label="Kp" value={hud.kp ?? "–"} />
          {hud.tier === "premium" && <>
            <HudBadge label="Bz" value={hud.bz != null ? `${hud.bz} nT` : "–"} />
            <HudBadge label={tr("globe.wind", "Tuuli")} value={hud.speed != null ? `${hud.speed} km/s` : "–"} />
            <HudBadge label={tr("globe.density", "Tiheys")} value={hud.density != null ? `${hud.density} p/cm³` : "–"} />
          </>}
        </>}
        <div style={{ flex: 1 }} />
        <span style={{ color: "rgba(230,233,239,0.65)", fontSize: 11, whiteSpace: "nowrap" }}>
          {quality === "high" ? tr("globe.quality.high", "High quality") : tr("globe.quality.smooth", "Smooth mode")}
        </span>
        <button onClick={() => setLayersOpen((o) => !o)} style={{
          pointerEvents: "auto", display: "inline-flex", alignItems: "center", gap: 5,
          background: layersOpen ? "rgba(0, 255, 198, 0.15)" : "rgba(8, 14, 26, 0.72)",
          border: "1px solid rgba(0, 255, 198, 0.35)", borderRadius: 999,
          padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "#00ffc6",
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          ☰ {tr("globe.layers", "Kerrokset")}
        </button>
      </div>

      {layersOpen && (
        <div style={{
          position: "absolute", top: 44, right: 10, zIndex: 1001,
          background: "rgba(7, 12, 28, 0.95)", border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8,
          minWidth: 160, boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
        }}>
          {[
            ["aurora", tr("globe.layer.aurora", "Revontulet")],
            ["borders", tr("globe.layer.borders", "Valtioiden rajat")],
            ["cities", tr("globe.layer.cities", "Kaupungit")],
            ["places", tr("globe.layer.places", "Paikat")],
          ].map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#e6e9ef", cursor: "pointer" }}>
              <input type="checkbox" checked={!!layers[key]} onChange={() => toggleLayer(key)} style={{ accentColor: "#00ffc6", width: 15, height: 15 }} />
              {label}
            </label>
          ))}
        </div>
      )}

      {clickPos && popupXY && (
        <div ref={popupRef} style={{ position: "absolute", left: popupXY.x, top: popupXY.y - 10, transform: "translate(-50%, -100%)", zIndex: 1000, pointerEvents: "auto" }}>
          <div style={{
            position: "relative", borderRadius: 22,
            background: "linear-gradient(180deg, rgba(7,12,28,0.96), rgba(5,8,20,0.98))",
            border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.55), 0 0 40px rgba(0,255,200,0.08)", padding: 15, overflow: "hidden",
          }}>
            <button onClick={closePopup} aria-label={tr("globe.close", "Sulje")} style={{
              position: "absolute", top: 10, right: 10, zIndex: 2, background: "none", border: "none",
              color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 18, padding: 0, lineHeight: 1,
            }}>✕</button>
            {clickLabel && <div style={{ position: "relative", zIndex: 1, fontSize: 13, fontWeight: 700, color: "#e6e9ef", margin: "2px 0 6px 5px" }}>📍 {clickLabel}</div>}
            <AuroraPopup lat={clickPos.lat} lng={clickPos.lng} data={popupData} error={popupError} loading={popupLoading} premium={premium} />
          </div>
          <div style={{ width: 17, height: 17, background: "rgba(5,8,20,0.98)", border: "1px solid rgba(255,255,255,0.08)", transform: "rotate(45deg)", margin: "-9px auto 0" }} />
        </div>
      )}

      {useDetailedTiles && (
        <div style={{ position: "absolute", right: 6, bottom: 4, zIndex: 4, fontSize: 9, color: "rgba(230, 233, 239, 0.55)", background: "rgba(2, 4, 10, 0.45)", padding: "1px 6px", borderRadius: 4, pointerEvents: "none" }}>
          Imagery © Esri, Maxar, Earthstar Geographics
        </div>
      )}

      {!premium && (
        <div className="globe-upsell">
          <div className="globe-upsell-text">{tr("globe.upsell", "Explore borders, cities, and the aurora with Premium — rotate & zoom the globe at your leisure.")}</div>
          <button className="globe-upsell-btn" onClick={() => onUpgrade?.()}>{tr("globe.upsellBtn", "Unlock with Premium")}</button>
        </div>
      )}
    </div>
  );
}
