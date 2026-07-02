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
    <div className="globe-view parannettu-globe" ref={wrapRef}>
      <Suspense fallback={<div className="globe-loading">{tr("globe.loading", "Loading globe…")}</div>}>
        {size.w > 0 && (
          <Globe
            ref={globeEl}
            width={size.w}
            height={size.h}
            onGlobeReady={onGlobeReady}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
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
          />
        )}
      </Suspense>

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