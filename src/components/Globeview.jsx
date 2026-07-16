/* ============================================================
 * Globeview.jsx — 3D-revontulikartta (map-sivun päänäkymä)
 * Apurit: ./globe/globeMath.js (laskenta), ./globe/globeData.js
 * (vakiot + lataajat), ./globe/Globeview.css (tyylit).
 * Sijainti: src/components/Globeview.jsx
 * ============================================================ */
import { useEffect, useRef, useState, Suspense, lazy, useCallback, useMemo } from "react";
import * as THREE from "three";
import useTranslation from "../hooks/useTranslation";
import staticPlaces from "../data/places";
import AuroraPopup from "./AuroraPopup";
import {
  BASE, DEFAULT_CALC_POINT, LOAD_TIMEOUT_MS,
  LAYERS_KEY, ENABLE_DETAILED_TILES_BY_DEFAULT,
  CLOUDS_IMG_URL, CARTO_TILE_URL, ESRI_TILE_URL,
  CLOSEUP_ENTER_ALT, CLOSEUP_EXIT_ALT,
  PLACE_NAMES_ENTER_ALT, PLACE_NAMES_EXIT_ALT,
  readLayers, readDeviceKey, requestIdle, cancelIdle,
  loadAuroraPoints, loadBorders, loadCities,
} from "./globe/globeData";
import {
  getGlobeQuality, deviceCanRenderGlobe, getAuroraColor,
  subsolarPoint, buildTerminator,
} from "./globe/globeMath";
import "./globe/Globeview.css";

/* HomePagen ennakkolataus-importti pysyy ennallaan tämän re-exportin kautta */
export { preloadGlobeAssets } from "./globe/globeData";

const Globe = lazy(() => import("react-globe.gl"));

/* Vakaat accessorit (ei uusia funktioita joka renderillä) */
const polygonSideColor = () => "rgba(255, 255, 255, 0.1)";
const polygonCapColor = () => "rgba(0, 0, 0, 0)";
const polygonStrokeColor = () => "#d4af37";
const labelColor = () => "rgba(212, 175, 55, 0.85)";
const heatmapPointsAccessor = d => d;
const ringColor = () => "rgba(0, 255, 198, 0.6)";
const terminatorColor = () => "rgba(110, 150, 255, 0.6)";

function HudBadge({ label, value }) {
  return (
    <span className="gv-badge">
      {label} <b>{value}</b>
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

  /* Lähizoom: tekstuurista karttatiiliin kun kamera on lähellä */
  const [closeUp, setCloseUp] = useState(false);
  const closeUpRef = useRef(false);

  /* Pilvet ja yövarjostus: three.js-meshit, luodaan laiskasti */
  const [globeReady, setGlobeReady] = useState(false);
  const cloudsRef = useRef(null);
  const nightShadeRef = useRef(null);

  /* Paikkojen nimilaput: kaukaa vain pisteet, nimet vasta lähizoomilla */
  const [showPlaceNames, setShowPlaceNames] = useState(false);
  const showPlaceNamesRef = useRef(false);

  /* Yön raja: lasketaan kun kerros on päällä */
  const [terminator, setTerminator] = useState([]);

  /* Ohjevihje (sama idea kuin 2D-kartan hint-popup) — kerran per selain */
  const [showHint, setShowHint] = useState(() => {
    try { return !localStorage.getItem("globe_hint_seen_v1"); } catch { return true; }
  });
  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem("globe_hint_seen_v1", "1"); } catch {}
  }, []);

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

  /* ---- Klikkauslaskenta: free → /calc, premium → /forecast ---- */
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
    dismissHint();
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
  }, [fetchPoint, size.h, size.w, dismissHint]);

  const onGlobeClick = useCallback((coords, e) => handleGlobeClick(coords, e), [handleGlobeClick]);
  const onPolygonClick = useCallback((p, e, coords) => handleGlobeClick(coords, e), [handleGlobeClick]);
  const onHeatmapClick = useCallback((h, e, coords) => handleGlobeClick(coords, e), [handleGlobeClick]);

  /* Marker: kaukaa pelkkä piste, lähempää piste + nimi */
  const makePlaceMarker = useCallback((d) => {
    const el = document.createElement("button");
    el.type = "button";
    el.title = d.name;
    el.className = "gv-marker";

    const wrap = document.createElement("span");
    wrap.className = "gv-marker-wrap";

    if (showPlaceNames) {
      const badge = document.createElement("span");
      badge.textContent = d.name;
      badge.className = "gv-marker-badge";
      wrap.appendChild(badge);
    }

    const dot = document.createElement("span");
    dot.className = showPlaceNames ? "gv-marker-dot" : "gv-marker-dot gv-marker-dot--plain";
    wrap.appendChild(dot);

    el.appendChild(wrap);
    el.onclick = (ev) => {
      ev.stopPropagation();
      handleGlobeClick({ lat: d.lat, lng: d.lon }, ev, d.name);
    };
    return el;
  }, [handleGlobeClick, showPlaceNames]);

  const closePopup = useCallback(() => {
    setClickPos(null);
    setClickLabel(null);
    setPopupXY(null);
  }, []);

  /* Popup seuraa klikattua pistettä (rAF + suora DOM-päivitys) */
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

  /* ---- Datan lataus (välimuistit hoitaa globeData) ---- */
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

  /* ---- Globen alustus ---- */
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
    // 100.8 = ei ihan pintaan asti — lähizoomin tiilet ovat tällä jo tarkat
    controls.minDistance = 100.8;
    controls.maxDistance = 500;
    // Mobiilissa aloitetaan kauempaa, jotta koko pallo mahtuu kapeaan ruutuun
    const isNarrow = (wrapRef.current?.clientWidth || window.innerWidth) < 640;
    g.pointOfView({ lat: 40, lng: -20, altitude: isNarrow ? 3.4 : 2.3 }, 0);

    // Korkeusperustaiset tilat hystereesillä (tiilet + nimilaput)
    controls.addEventListener("change", () => {
      const alt = g.pointOfView()?.altitude;
      if (alt == null) return;
      const next = closeUpRef.current ? alt < CLOSEUP_EXIT_ALT : alt < CLOSEUP_ENTER_ALT;
      if (next !== closeUpRef.current) {
        closeUpRef.current = next;
        setCloseUp(next);
      }
      const names = showPlaceNamesRef.current
        ? alt < PLACE_NAMES_EXIT_ALT
        : alt < PLACE_NAMES_ENTER_ALT;
      if (names !== showPlaceNamesRef.current) {
        showPlaceNamesRef.current = names;
        setShowPlaceNames(names);
      }
    });

    setGlobeReady(true);
  }, [premium]);

  useEffect(() => {
    const g = globeEl.current;
    if (!g) return;
    const controls = g.controls();
    controls.autoRotate = false;
    controls.enableZoom = premium;
    controls.enableRotate = premium;
  }, [premium]);

  /* ---- Yön raja: viiva + varjostus (10 min päivitysrytmi) ---- */
  useEffect(() => {
    if (!layers.night) {
      setTerminator([]);
      if (nightShadeRef.current) nightShadeRef.current.visible = false;
      return;
    }

    const update = () => {
      setTerminator(buildTerminator());

      const g = globeEl.current;
      if (!g || !globeReady || typeof g.getCoords !== "function") return;
      const sub = subsolarPoint();
      const c = g.getCoords(sub.lat, sub.lng, 0);
      const len = Math.hypot(c.x, c.y, c.z) || 1;

      if (!nightShadeRef.current) {
        const mat = new THREE.ShaderMaterial({
          uniforms: { sunDir: { value: new THREE.Vector3(c.x / len, c.y / len, c.z / len) } },
          transparent: true,
          depthWrite: false,
          vertexShader: `
            varying vec3 vN;
            void main() {
              vN = normalize(normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform vec3 sunDir;
            varying vec3 vN;
            void main() {
              float d = dot(normalize(vN), sunDir);
              // 1.0 syvällä yössä, 0.0 päivällä — pehmeä liuku rajan yli
              float night = 1.0 - smoothstep(-0.14, 0.08, d);
              gl_FragColor = vec4(0.0, 0.01, 0.05, night * 0.55);
            }
          `,
        });
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(g.getGlobeRadius() * 1.01, 64, 64),
          mat
        );
        mesh.renderOrder = 2; // pilvien (1) yläpuolelle → yö tummentaa myös pilvet
        nightShadeRef.current = mesh;
        g.scene().add(mesh);
      } else {
        nightShadeRef.current.material.uniforms.sunDir.value.set(c.x / len, c.y / len, c.z / len);
        nightShadeRef.current.visible = true;
      }
    };

    update();
    const timer = setInterval(update, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [layers.night, globeReady]);

  /* ---- Pilvikerros ---- */
  useEffect(() => {
    const g = globeEl.current;
    if (!g || !globeReady) return;

    if (!layers.clouds) {
      if (cloudsRef.current) cloudsRef.current.visible = false;
      return;
    }

    if (cloudsRef.current) {
      cloudsRef.current.visible = true;
      return;
    }

    let cancelled = false;
    new THREE.TextureLoader().load(
      CLOUDS_IMG_URL,
      (texture) => {
        if (cancelled || !globeEl.current) { texture.dispose(); return; }
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(globeEl.current.getGlobeRadius() * 1.008, 64, 64),
          new THREE.MeshLambertMaterial({
            map: texture,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
          })
        );
        mesh.renderOrder = 1;
        cloudsRef.current = mesh;
        globeEl.current.scene().add(mesh);
      },
      undefined,
      (e) => console.warn("Pilvitekstuurin lataus epäonnistui:", e)
    );
    return () => { cancelled = true; };
  }, [layers.clouds, globeReady]);

  /* Meshien siivous kun komponentti puretaan */
  useEffect(() => () => {
    const clouds = cloudsRef.current;
    if (clouds) {
      clouds.geometry?.dispose();
      clouds.material?.map?.dispose();
      clouds.material?.dispose();
      cloudsRef.current = null;
    }
    const shade = nightShadeRef.current;
    if (shade) {
      shade.geometry?.dispose();
      shade.material?.dispose();
      nightShadeRef.current = null;
    }
  }, []);

  /* Karttapohja: lähizoom → Carto dark; kaukana → Esri-tiilet (detailed)
     tai kevyt blue-marble-tekstuuri (oletus) */
  const tileProps = closeUp
    ? { globeTileEngineUrl: CARTO_TILE_URL }
    : useDetailedTiles
      ? { globeTileEngineUrl: ESRI_TILE_URL }
      : {
          globeImageUrl: "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
          bumpImageUrl: "//unpkg.com/three-globe/example/img/earth-topology.png",
        };

  return (
    <div className="globe-view parannettu-globe gv-root" ref={wrapRef}>
      <Suspense fallback={<div className="globe-loading">{tr("globe.loading", "Loading globe…")}</div>}>
        {size.w > 0 && (
          <Globe
            ref={globeEl}
            width={size.w}
            height={size.h}
            rendererConfig={{ powerPreference: quality === "high" ? "high-performance" : "default" }}
            onGlobeReady={onGlobeReady}
            {...tileProps}
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
            htmlElementsData={layers.places ? placeMarkers : []}
            htmlLat="lat"
            htmlLng="lon"
            htmlAltitude={0.004}
            htmlElement={makePlaceMarker}
            ringsData={clickPos ? [clickPos] : []}
            ringLat="lat"
            ringLng="lng"
            ringColor={ringColor}
            ringMaxRadius={3}
            ringPropagationSpeed={2}
            ringRepeatPeriod={1000}
            pathsData={layers.night && terminator.length ? [terminator] : []}
            pathPointAlt={0.006}
            pathColor={terminatorColor}
            pathStroke={2.5}
            pathsTransitionDuration={0}
          />
        )}
      </Suspense>

      {/* Mittaripalkki headerin alla + kerrosvalikon avaus */}
      <div className="gv-hudbar">
        {hud && <>
          <HudBadge label="Kp" value={hud.kp ?? "–"} />
          {hud.tier === "premium" && <>
            <HudBadge label="Bz" value={hud.bz != null ? `${hud.bz} nT` : "–"} />
            <HudBadge label={tr("globe.wind", "Tuuli")} value={hud.speed != null ? `${hud.speed} km/s` : "–"} />
            <HudBadge label={tr("globe.density", "Tiheys")} value={hud.density != null ? `${hud.density} p/cm³` : "–"} />
          </>}
        </>}
        <div className="gv-spacer" />
        <span className="gv-quality">
          {quality === "high" ? tr("globe.quality.high", "High quality") : tr("globe.quality.smooth", "Smooth mode")}
        </span>
        <button
          className={`gv-layers-btn ${layersOpen ? "gv-layers-btn--open" : ""}`}
          onClick={() => setLayersOpen((o) => !o)}
        >
          ☰ {tr("globe.layers", "Kerrokset")}
        </button>
      </div>

      {/* Kerrosvalikko */}
      {layersOpen && (
        <div className="gv-layers-menu">
          {[
            ["aurora", tr("globe.layer.aurora", "Revontulet")],
            ["clouds", tr("globe.layer.clouds", "Pilvet")],
            ["night", tr("globe.layer.night", "Yön raja")],
            ["borders", tr("globe.layer.borders", "Valtioiden rajat")],
            ["cities", tr("globe.layer.cities", "Kaupungit")],
            ["places", tr("globe.layer.places", "Paikat")],
          ].map(([key, label]) => (
            <label key={key} className="gv-layers-item">
              <input type="checkbox" checked={!!layers[key]} onChange={() => toggleLayer(key)} />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Ohjevihje — sama viesti kuin 2D-kartan hint-popupissa */}
      {showHint && !clickPos && (
        <div className="gv-hint">
          <button className="gv-close" onClick={dismissHint} aria-label={tr("globe.close", "Sulje")}>✕</button>
          <strong>{tr("globe.hint.title", "Explore aurora forecast")}</strong>
          <p>{tr("globe.hint.body", "Tap anywhere on the globe to view live aurora probability and conditions.")}</p>
        </div>
      )}

      {/* Klikatun pisteen popup — sama AuroraPopup kuin 2D-kartalla */}
      {clickPos && popupXY && (
        <div ref={popupRef} className="gv-popup-wrap" style={{ left: popupXY.x, top: popupXY.y - 10 }}>
          <div className="gv-popup-card">
            {clickLabel && <div className="gv-popup-label">📍 {clickLabel}</div>}
            <AuroraPopup
              lat={clickPos.lat}
              lng={clickPos.lng}
              data={popupData}
              error={popupError}
              loading={popupLoading}
              premium={premium}
              onClose={closePopup}
            />
          </div>
          <div className="gv-popup-tip" />
        </div>
      )}

      {/* Attribuutiot */}
      {(closeUp || useDetailedTiles || layers.clouds) && (
        <div className="gv-attribution">
          {[
            closeUp
              ? "© OpenStreetMap contributors © CARTO"
              : (useDetailedTiles ? "Imagery © Esri, Maxar, Earthstar Geographics" : null),
            layers.clouds ? "Clouds © EUMETSAT" : null,
          ].filter(Boolean).join(" · ")}
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