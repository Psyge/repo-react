import { useEffect, useRef, useState, Suspense, lazy, useCallback } from "react";
import useTranslation from "../hooks/useTranslation";

/* ========================================================================
   GlobeView — valinnainen 3D-maapallo revontulilla (react-globe.gl)

   - Lazy-ladattu (oma chunk) → ei kuormita 2D-karttaa
   - Yhteys/laite-gate + timeout → heikolla ohjautuu takaisin 2D-karttaan
   - FREE: preset-näkymä (auto-pyörintä, EI zoom/raahaus) + premium-upsell
   - PREMIUM: täysi vuorovaikutus (pyöritys + zoom)

   Asennus:  npm i react-globe.gl
   (vetää three-globen; käyttää jo asennettua three:a)
======================================================================== */

const Globe = lazy(() => import("react-globe.gl"));

// NOAA OVATION — revontulien todennäköisyys lat/lon-ruudukkona
const OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
const LOAD_TIMEOUT_MS = 9000;

// Vain napojen seudut + kynnys → kevyempi pistemäärä
const MIN_AURORA = 8;     // 0..100, näytä pisteet tästä ylöspäin
const MIN_ABS_LAT = 40;   // jätä päiväntasaajan kohina pois

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

function auroraColor(val) {
  if (val >= 45) return "#ff3b7f";  // voimakas → pinkki
  if (val >= 22) return "#7b5fff";  // kohtalainen → violetti
  return "#16ff8a";                  // heikko → vihreä
}

export default function GlobeView({ premium = false, onFallback, onUpgrade }) {
  const { t } = useTranslation();
  const globeEl = useRef(null);
  const readyRef = useRef(false);

  const [points, setPoints] = useState([]);
  const [size, setSize]   = useState({ w: 0, h: 0 });
  const wrapRef = useRef(null);

  const tr = useCallback((k, d) => {
    const s = t(k);
    return s == null || s === k ? d : s;
  }, [t]);

  // Mittaa kontti (Globe tarvitsee width/height)
  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Gate + datan haku + timeout-fallback
  useEffect(() => {
    if (!deviceCanRenderGlobe()) {
      onFallback?.("unsupported");
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (!readyRef.current && !cancelled) onFallback?.("timeout");
    }, LOAD_TIMEOUT_MS);

    fetch(OVATION_URL, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const coords = data?.coordinates || [];
        const pts = [];
        for (let i = 0; i < coords.length; i++) {
          const c = coords[i];
          const lng = c[0] > 180 ? c[0] - 360 : c[0];
          const lat = c[1];
          const val = c[2];
          if (val >= MIN_AURORA && Math.abs(lat) >= MIN_ABS_LAT) {
            pts.push({ lat, lng, val });
          }
        }
        setPoints(pts);
      })
      .catch(() => { /* pallo näkyy ilman revontulia jos haku epäonnistuu */ });

    return () => { cancelled = true; clearTimeout(timer); };
  }, [onFallback]);

  const onGlobeReady = useCallback(() => {
    readyRef.current = true;
    const g = globeEl.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = premium ? 0.35 : 0.6;
    controls.enablePan = false;
    controls.enableZoom = premium;     // FREE: ei zoomia
    controls.enableRotate = premium;   // FREE: ei manuaalista pyöritystä
    // Aloitusnäkymä Lapin ylle
    g.pointOfView({ lat: 69, lng: 25, altitude: 2.3 }, 0);
  }, [premium]);

  return (
    <div className="globe-view" ref={wrapRef}>
      <Suspense fallback={<div className="globe-loading">{tr("globe.loading", "Loading globe…")}</div>}>
        {size.w > 0 && (
          <Globe
            ref={globeEl}
            width={size.w}
            height={size.h}
            onGlobeReady={onGlobeReady}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            showAtmosphere
            atmosphereColor="#00ffc6"
            atmosphereAltitude={0.08}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor={(d) => auroraColor(d.val)}
            pointAltitude={(d) => 0.01 + (Math.min(d.val, 100) / 100) * 0.09}
            pointRadius={0.22}
            pointsMerge={true}
          />
        )}
      </Suspense>

      {/* FREE: upsell — ei vuorovaikutusta ilman premiumia */}
      {!premium && (
        <div className="globe-upsell">
          <div className="globe-upsell-text">
            🔒 {tr("globe.upsell", "Rotate & zoom the globe with Premium — explore the aurora from any angle.")}
          </div>
          <button className="globe-upsell-btn" onClick={() => onUpgrade?.()}>
            {tr("globe.upsellBtn", "Unlock with Premium")}
          </button>
        </div>
      )}
    </div>
  );
}