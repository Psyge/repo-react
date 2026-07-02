import { useEffect, useRef, useState, Suspense, lazy, useCallback } from "react";
import useTranslation from "../hooks/useTranslation";

/* ========================================================================
   GlobeView — Päivitetty, orgaanisempi 3D-maapallo revontulilla,
               valtioiden rajoilla ja kaupunkinimillä
   (react-globe.gl)
   
   Asennus:  npm i react-globe.gl
   (vetää three-globen; käyttää jo asennettua three:a)
======================================================================== */

const Globe = lazy(() => import("react-globe.gl"));

// Datan URL-osoitteet
const OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
// Käytetään pienikokoisia GeoJSON-datasettejä suorituskyvyn vuoksi
const BORDERS_URL = "https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson";
const CITIES_URL = "https://raw.githubusercontent.com/datasets/major-cities/master/major-cities.json";

const LOAD_TIMEOUT_MS = 15000; // Pidempi timeout useamman datasettin lataukselle

// Revontulien suodatuksen kynnykset
const MIN_AURORA = 10;     // 0..100, näytä pisteet tästä ylöspäin
const MIN_ABS_LAT = 45;   // Jätetään enemmän päiväntasaajaa pois tarkemman visualisoinnin saamiseksi

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

/* Pehmeä, orgaaninen aurora-gradientti: läpinäkyvä reuna → vihreä → cyan → violetti → pinkki.
   Säädetty orgaanisemmaksi ja läpinäkyvämmäksi. */
function auroraOraganicColor(t) {
  const stops = [
    [0.00, [0, 255, 120, 0]],     // Täysin läpinäkyvä vihreä reuna
    [0.20, [0, 255, 140, 0.4]],   // Pehmeä vihreä
    [0.50, [20, 255, 230, 0.7]],  // Syaani/vaaleansininen
    [0.80, [150, 100, 255, 0.9]], // Violetti
    [1.00, [255, 100, 200, 0.95]] // Pinkki/purppura
  ];
  t = Math.max(0, Math.min(1, Number(t) || 0));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const t0 = stops[i - 1][0], c0 = stops[i - 1][1];
      const t1 = stops[i][0], c1 = stops[i][1];
      const f = (t - t0) / ((t1 - t0) || 1);
      const ch = (k) => Math.round(c0[k] + (c1[k] - c0[k]) * f);
      // Alpha kasvaa voimakkuuden mukaan, mutta pysyy aina hieman orgaanisesti läpinäkyvänä
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

  // Useat datasettin tilat
  const [auroraPoints, setAuroraPoints] = useState([]);
  const [countriesBorders, setCountriesBorders] = useState([]);
  const [citiesData, setCitiesData] = useState([]);
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

  // Useiden datasettin haku, suodatus ja timeout-fallback
  useEffect(() => {
    if (!deviceCanRenderGlobe()) {
      onFallback?.("unsupported");
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (!readyRef.current && !cancelled) onFallback?.("timeout");
    }, LOAD_TIMEOUT_MS);

    // Haetaan kaikki data samanaikaisesti suorituskyvyn vuoksi
    Promise.all([
      fetch(OVATION_URL, { cache: "no-store" }).then(r => r.json()),
      fetch(BORDERS_URL).then(r => r.json()),
      fetch(CITIES_URL).then(r => r.json())
    ])
    .then(([ovationData, bordersGeoJson, citiesJson]) => {
      if (cancelled) return;

      // 1. Revontulidata -> Sadoittain pieniä pisteitä pilveksi
      const coords = ovationData?.coordinates || [];
      const pts = [];
      for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        const val = c[2];
        if (val >= MIN_AURORA) {
          const lat = c[1];
          if (Math.abs(lat) >= MIN_ABS_LAT) {
            // Tehdään moninkertaisesti pieniä, hajautettuja pisteitä pilveksi
            // (Simuloidaan pilveä sadoilla pisteillä, ei bin-pilareilla)
            const ptsPerCoord = 1; // Pieni määrä pisteitä per koordinaatti riittää luomaan pilven
            for (let j = 0; j < ptsPerCoord; j++) {
                pts.push({
                  lat: lat,
                  lng: c[0] > 180 ? c[0] - 360 : c[0],
                  val: val / 100, // Normalisoidaan 0-1
                  // Lisätään orgaanista hajontaa ja kokoa pisteille
                  size: 0.1 + (val / 100) * 1.5 + (Math.random() * 0.2)
                });
            }
          }
        }
      }
      setAuroraPoints(pts);

      // 2. Valtioiden rajat GeoJSONista -> Kultaiset linjat
      setCountriesBorders(bordersGeoJson.features);

      // 3. Kaupunkidata -> Kultaiset pisteet ja nimet
      // (Suodatetaan vain suurimmat kaupungit selkeyden vuoksi)
      const majorCities = citiesJson.features
        .filter(f => f.properties.population > 100000)
        .map(f => ({
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          name: f.properties.name,
          country: f.properties.country,
          population: f.properties.population
        }));
      setCitiesData(majorCities);

    })
    .catch((e) => {
        // Hätätilanne: näytetään vain pallo, ei dataa
        console.error("Virhe ladattaessa globe-dataa:", e);
    });

    return () => { cancelled = true; clearTimeout(timer); };
  }, [onFallback]);

  const onGlobeReady = useCallback(() => {
    readyRef.current = true;
    const globe = globeEl.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = !premium;
    controls.autoRotateSpeed = 0.5;
    controls.enablePan = false;
    controls.enableZoom = premium;
    controls.enableRotate = premium;
    // Aloitusnäkymä Pohjois-Atlantin ja Euroopan ylle, jotta rajat ja kaupungit näkyvät
    globe.pointOfView({ lat: 40, lng: -20, altitude: 2.3 }, 0);
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
            
            /* --- TEKSTUURIT --- */
            // Vaihdettu yö-tekstuuriin, jotta rajat ja kaupungit korostuvat
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            
            /* --- ILMAKEHÄ --- */
            showAtmosphere
            // Säädetty viileämmäksi ja orgaanisemmaksi (cool blue)
            atmosphereColor="#00e6ff" 
            atmosphereAltitude={0.12}

            /* --- VALTIOIDEN RAJAT (Polygons) --- */
            polygonsData={countriesBorders}
            polygonAltitude={0.005} // Hieman pinnan yläpuolella
            polygonSideColor={() => "rgba(255, 255, 255, 0.1)"} // Läpinäkyvä sivu
            polygonCapColor={() => "transparent"} // Ei täytettä, vain ääriviivat
            polygonStrokeColor={() => "#d4af37"} // Kultaiset ääriviivat rajoille
            polygonStrokeWidth={0.8}

            /* --- KAUPUNGIT (Labels) --- */
            labelsData={citiesData}
            labelLabel={d => d.name}
            // Kultainen rengas pisteeksi
            labelDotColor={() => "rgba(212, 175, 55, 0.9)"}
            // Kultainen teksti
            labelColor={() => "rgba(212, 175, 55, 0.85)"}
            labelAltitude={0.006}
            labelSize={0.4}
            // Pieni kultainen rengas merkiksi
            ringsData={citiesData}
            ringColor={() => "rgba(212, 175, 55, 0.8)"}
            ringAltitude={0.005}
            ringRadius={0.15}
            ringRepeat={1}
            
            /* --- REVONTULET (Points as soft clouds) --- */
            // Poistettu geometriset hex-pilaukset, käytetään satoja pisteitä pilveksi
            pointsData={auroraPoints}
            pointLat="lat"
            pointLng="lng"
            pointColor={d => auroraOraganicColor(d.val)}
            pointAltitude={0.05} // Nostettu korkeammalle orgaanisen pilven saamiseksi
            pointRadius="size"
            pointsMerge={true}  // Yhdistetään pisteet suorituskyvyn vuoksi
            pointsTransitionDuration={1000}
          />
        )}
      </Suspense>

      <style jsx global>{`
        .globe-upsell-text {
            color: #d4af37 !important; /* Kultainen Upsell-teksti */
        }
        .parannettu-globe {
            position: relative;
        }
      `}</style>

      {/* FREE: upsell */}
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