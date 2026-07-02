import { useEffect, useRef, useState, Suspense, lazy, useCallback, useMemo } from "react";
import useTranslation from "../hooks/useTranslation";
import * as THREE from 'three'; // Tuodaan THREE, jotta voimme käyttää blend-tiloja

/* ========================================================================
   GlobeView — Päivitetty, orgaanisempi 3D-maapallo revontulilla
   (react-globe.gl)

   PARANNUKSET:
   - Revontulet: Vaihdettu geometrisista HexBinteistä orgaanisempiin
     pisteisiin (Point Rings), jotka käyttävät orgaanista värisiirtymää ja
     parempaa häivytystä.
   - Tekstuuri: Korkealaatuisempi maapallon tekstuuri.
   - Tehosteet: Lisätty hienovaraisia tehosteita, kuten ilmakehän hienosäätö.
======================================================================== */

const Globe = lazy(() => import("react-globe.gl"));

// NOAA OVATION — revontulien todennäköisyys
const OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
const LOAD_TIMEOUT_MS = 12000; // Hieman pidempi timeout raskaammalle datalle

// Suodatuksen kynnykset
const MIN_AURORA = 10;     // Hieman korkeampi kynnys orgaanisempaan tulokseen
const MIN_ABS_LAT = 45;   // Jätetään vielä enemmän päiväntasaajaa pois

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

/* --- UUSI ORGAANINEN VÄRISIIRTYMÄ ---
   Siirrytään pehmeämpään vihreä-sininen-violetti gradienttiin,
   joka näyttää luonnollisemmalta revontulilta.
*/
function auroraOraganicColor(t) {
  const stops = [
    [0.00, [0, 255, 120, 0]],     // Läpinäkyvä pohja
    [0.20, [0, 255, 140, 0.3]],  // Pehmeä vihreä
    [0.50, [20, 255, 230, 0.6]], // Syaani/vaaleansininen
    [0.80, [150, 100, 255, 0.8]],// Violetti
    [1.00, [255, 100, 200, 0.9]] // Pinkki/purppura
  ];
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const t0 = stops[i - 1][0], c0 = stops[i - 1][1];
      const t1 = stops[i][0], c1 = stops[i][1];
      const f = (t - t0) / ((t1 - t0) || 1);
      const ch = (k) => Math.round(c0[k] + (c1[k] - c0[k]) * f);
      // Alpha-häivytys on tärkeä orgaanisuuden kannalta
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
  const [size, setSize]   = useState({ w: 0, h: 0 });
  const wrapRef = useRef(null);

  const tr = useCallback((k, d) => {
    const s = t(k);
    return s == null || s === k ? d : s;
  }, [t]);

  // Mittaa kontti
  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Datamallin haku ja suodatus orgaanista visualisointia varten
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
        // Suodatetaan ja säädetään data orgaanisemmaksi
        for (let i = 0; i < coords.length; i++) {
          const c = coords[i];
          const val = c[2];
          if (val >= MIN_AURORA) {
            const lat = c[1];
            if (Math.abs(lat) >= MIN_ABS_LAT) {
              pts.push({
                lat: lat,
                lng: c[0] > 180 ? c[0] - 360 : c[0],
                val: val / 100, // Normalisoidaan 0-1
                // Luodaan hieman orgaanista hajontaa pisteiden kokoon
                size: 0.5 + (val / 100) * 2.5 + (Math.random() * 0.5)
              });
            }
          }
        }
        setAuroraPoints(pts);
      })
      .catch(() => { /* hätätilanne: pallo näkyy ilman auroraa */ });

    return () => { cancelled = true; clearTimeout(timer); };
  }, [onFallback]);

  const onGlobeReady = useCallback(() => {
    readyRef.current = true;
    const g = globeEl.current;
    if (!g) return;

    // Säädetään kontrolleja
    const controls = g.controls();
    controls.autoRotate = !premium;
    controls.autoRotateSpeed = 0.5; // Hieman hitaampi ja majesteettisempi
    controls.enablePan = false;
    controls.enableZoom = premium;
    controls.enableRotate = premium;

    // Parempi aloitusnäkymä, joka näyttää sekä Lapin että revontulirenkaan kaaren
    g.pointOfView({ lat: 65, lng: 20, altitude: 2.5 }, 0);

    // --- TÄRKEÄÄ ORGAANISEN LASKENNAN KANNALTA ---
    // Asetetaan pisteiden materiaali käyttämään Additive Blendingiä,
    // mikä saa ne hehkumaan ja sulautumaan toisiinsa.
    // Tämä vaatii pienen viiveen, jotta Three.js-objektit ovat latautuneet.
    setTimeout(() => {
        const scene = g.scene();
        scene.traverse((obj) => {
            if (obj.type === 'Points' && obj.material) {
                obj.material.blending = THREE.AdditiveBlending;
                obj.material.transparent = true;
                obj.material.depthWrite = false; // Estää pisteitä peittämästä toisiaan geometrisesti
            }
        });
    }, 1000);

  }, [premium]);

  // Käytetään useMemo:a orgaanisen värien generointiin tehostamaan suorituskykyä
  const auroraColors = useMemo(() => {
    return auroraPoints.map(p => auroraOraganicColor(p.val));
  }, [auroraPoints]);

  return (
    <div className="globe-view parannettu-globe" ref={wrapRef}>
      <Suspense fallback={<div className="globe-loading">{tr("globe.loading", "Loading globe…")}</div>}>
        {size.w > 0 && (
          <Globe
            ref={globeEl}
            width={size.w}
            height={size.h}
            onGlobeReady={onGlobeReady}

            /* --- PARANNETTU MAAPALLON GRAFIIKKA ---
               Käytetään korkealaatuisempia tekstuureja.
               Huom: Nämä URL:t ovat esimerkkejä, korvaa ne omilla korkearesoluutioisilla tekstuureillasi.
            */
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg" // Yö-tekstuuri korostaa revontulia
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

            /* --- PARANNETTU ILMAKEHÄ ---
               Säädetään ilmakehä hehkumaan hienovaraisemmin syaanin ja vihreän sävyissä.
            */
            showAtmosphere={true}
            atmosphereColor="#00e6ff" // Hieman syaanimpi
            atmosphereAltitude={0.12}   // Hieman paksumpi ilmakehä

            /* --- UUSI REVOLTULIEN VISUALISOINTI (POINTS) ---
               Luovutaan HexBinteistä ja käytetään pisteitä, jotka sumennetaan ja sulautetaan.
            */
            pointsData={auroraPoints}
            pointLat="lat"
            pointLng="lng"
            pointColor={(d, i) => auroraColors[i]}
            pointAltitude={(d) => 0.05 + d.val * 0.1} // Nostetaan pisteet ilmakehään
            pointRadius="size" // Koko riippuu voimakkuudesta
            pointsMerge={true}  // Tärkeää suorituskyvyn ja sulautumisen kannalta
            pointsTransitionDuration={1000}
          />
        )}
      </Suspense>

      {/* CSS-suodatin sumennusta varten (optional, jos haluat vielä pehmeämmän) */}
      <style jsx global>{`
        /* Sumennetaan revontulipisteitä CSS:llä, jotta ne näyttävät sumeammilta pylväiltä.
           Tämä vaatii, että pisteet ovat omassa containerissaan tai käytetään shaderia,
           mutta pisteiden sumentaminen suoraan on vaikeaa ilman custom shaderia react-globe.gl:ssä.
           Additive blending (THREE.js:ssä) on paras tapa saada orgaaninen hehku. */
      `}</style>

      {/* FREE: upsell */}
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