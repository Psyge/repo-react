import { useEffect, useRef, useState, Suspense, lazy, useCallback } from "react";
import useTranslation from "../hooks/useTranslation";

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

const LEVEL_FI = {
  low: "Matala",
  medium: "Kohtalainen",
  high: "Korkea",
  veryhigh: "Erittäin korkea",
};

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

  /* Klikkauslaskenta: /api/aurora/calc klikatulle pisteelle (gating serverillä) */
  const [calc, setCalc] = useState(null);          // viimeisin calc-vastaus
  const [calcLoading, setCalcLoading] = useState(false);
  const [clickPos, setClickPos] = useState(null);  // { lat, lng }

  const fetchCalc = useCallback(async (lat, lng) => {
    setCalcLoading(true);
    try {
      const res = await fetch(`${BASE}/api/aurora/calc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon: lng, deviceKey: readDeviceKey() }),
      });
      const data = await res.json();
      if (res.ok) setCalc({ ...data, lat, lng });
    } catch (e) {
      console.warn("aurora calc failed:", e);
    }
    setCalcLoading(false);
  }, []);

  /* Oletuspisteen arvot HUDiin heti kun komponentti aukeaa */
  useEffect(() => {
    fetchCalc(DEFAULT_CALC_POINT.lat, DEFAULT_CALC_POINT.lng);
  }, [fetchCalc]);

  const handleGlobeClick = useCallback(({ lat, lng }) => {
    setClickPos({ lat, lng });
    fetchCalc(lat, lng);
  }, [fetchCalc]);

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

    // KORJAUS: Promise.allSettled -> yhden lähteen epäonnistuminen ei enää
    // estä muiden (esim. rajojen) näkymistä.
    Promise.allSettled([
      fetch(OVATION_URL, { cache: "no-store" }).then(r => r.json()),
      fetch(BORDERS_URL).then(r => {
        if (!r.ok) throw new Error("Country borders data not found.");
        return r.json();
      }),
      fetch(CITIES_URL).then(r => {
        if (!r.ok) throw new Error("Major cities data not found.");
        return r.json();
      })
    ])
    .then(([ovationRes, bordersRes, citiesRes]) => {
      if (cancelled) return;

      if (ovationRes.status === "fulfilled") {
        const coords = ovationRes.value?.coordinates || [];
        const pts = [];
        for (let i = 0; i < coords.length; i++) {
          const c = coords[i];
          const val = c[2];
          if (val >= MIN_AURORA) {
            const lat = c[1];
            if (Math.abs(lat) >= MIN_ABS_LAT) {
              pts.push({
                lat: lat,
                lng: c[0] > 180 ? c[0] - 360 : c[0],
                val: val / 100
              });
            }
          }
        }
        setAuroraPoints(pts);
      } else {
        console.error("Virhe ladattaessa aurora-dataa:", ovationRes.reason);
      }

      if (bordersRes.status === "fulfilled") {
        setCountriesBorders(bordersRes.value.features || []);
      } else {
        console.error("Virhe ladattaessa rajadataa:", bordersRes.reason);
      }

      if (citiesRes.status === "fulfilled") {
        // KORJAUS: Natural Earth -aineistossa kentät ovat name / adm0name /
        // pop_max ja koordinaatit properties.latitude/longitude.
        const majorCities = (citiesRes.value.features || [])
          .filter(f => (f.properties.pop_max || 0) > MIN_CITY_POP)
          .map(f => ({
            lat: f.properties.latitude ?? f.geometry.coordinates[1],
            lng: f.properties.longitude ?? f.geometry.coordinates[0],
            name: f.properties.name,
            // KORJAUS: three-globen label-fontti ei sisällä ø/å/ü yms.
            // merkkejä → näkyvä teksti ASCII-muodossa, oikea nimi tooltipissa.
            nameAscii: f.properties.nameascii || f.properties.name,
            country: f.properties.adm0name,
            population: f.properties.pop_max
          }));
        setCitiesData(majorCities);
      } else {
        console.error("Virhe ladattaessa kaupunkidataa:", citiesRes.reason);
      }
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
            onGlobeReady={onGlobeReady}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            showAtmosphere={true}
            atmosphereColor="#00e6ff"
            atmosphereAltitude={0.12}
            polygonsData={countriesBorders}
            polygonAltitude={0.005}
            polygonSideColor={() => "rgba(255, 255, 255, 0.1)"}
            polygonCapColor={() => "rgba(0, 0, 0, 0)"}
            polygonStrokeColor={() => "#d4af37"}
            polygonsTransitionDuration={0}
            labelsData={citiesData}
            labelLat="lat"
            labelLng="lng"
            labelText="nameAscii"
            labelLabel={d => `${d.name}, ${d.country}`}
            labelColor={() => "rgba(212, 175, 55, 0.85)"}
            labelAltitude={0.006}
            labelSize={0.5}
            labelDotRadius={0.15}
            labelResolution={2}
            heatmapsData={auroraPoints.length ? [auroraPoints] : []}
            heatmapPoints={d => d}
            heatmapPointLat="lat"
            heatmapPointLng="lng"
            heatmapPointWeight="val"
            heatmapBandwidth={2.2}
            heatmapColorFn={() => getAuroraColor}
            heatmapColorSaturation={2.8}
            heatmapBaseAltitude={0.012}
            heatmapsTransitionDuration={1500}
            onGlobeClick={handleGlobeClick}
            onPolygonClick={(p, e, coords) => coords && handleGlobeClick(coords)}
            onHeatmapClick={(h, e, coords) => coords && handleGlobeClick(coords)}
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

      {/* Mittari-HUD: globaalit avaruussääarvot pelkkinä numeroina.
          Free näkee Kp:n, premium myös Bz/tuuli/tiheys (tulee serveriltä). */}
      {calc && (
        <div style={{
          position: "absolute", top: 12, left: 12,
          display: "flex", gap: 6, flexWrap: "wrap",
          zIndex: 5, pointerEvents: "none",
          maxWidth: "calc(100% - 24px)",
        }}>
          <HudBadge label="Kp" value={calc.kp ?? "–"} />
          {calc.tier === "premium" && (
            <>
              <HudBadge label="Bz" value={calc.bz != null ? `${calc.bz} nT` : "–"} />
              <HudBadge label={tr("globe.wind", "Tuuli")} value={calc.speed != null ? `${calc.speed} km/s` : "–"} />
              <HudBadge label={tr("globe.density", "Tiheys")} value={calc.density != null ? `${calc.density} p/cm³` : "–"} />
            </>
          )}
        </div>
      )}

      {/* Klikatun pisteen kortti */}
      {clickPos && (
        <div style={{
          position: "absolute", left: "50%", bottom: 14,
          transform: "translateX(-50%)",
          zIndex: 6,
          background: "rgba(8, 14, 26, 0.85)",
          border: "1px solid rgba(0, 255, 198, 0.25)",
          borderRadius: 12,
          padding: "10px 14px",
          minWidth: 200, maxWidth: "90%",
          color: "#e6e9ef", fontSize: 13,
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <strong>{clickPos.lat.toFixed(1)}°, {clickPos.lng.toFixed(1)}°</strong>
            <button
              onClick={() => setClickPos(null)}
              aria-label={tr("globe.close", "Sulje")}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 15, padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          {calcLoading ? (
            <div style={{ color: "#94a3b8" }}>{tr("globe.calcLoading", "Lasketaan…")}</div>
          ) : calc && (
            calc.tier === "premium" ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#00ffc6", lineHeight: 1.2 }}>
                  {calc.probability}%
                </div>
                <div style={{ color: "#94a3b8" }}>
                  ☁ {calc.clouds != null ? `${calc.clouds}%` : "–"}
                  {calc.temp != null ? ` · ${calc.temp}°C` : ""}
                  {calc.windMs != null ? ` · ${calc.windMs} m/s` : ""}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, color: "#00ffc6" }}>
                  {LEVEL_FI[calc.level] || calc.level}
                </div>
                <div style={{ color: "#94a3b8" }}>☁ {calc.clouds != null ? `${calc.clouds}%` : "–"}</div>
                <div style={{ color: "#67e8f9", fontSize: 12, marginTop: 4 }}>
                  🔒 {tr("globe.premiumHint", "Tarkka todennäköisyys Premiumilla")}
                </div>
              </>
            )
          )}
        </div>
      )}

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