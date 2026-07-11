import { useEffect, useRef, useCallback, Suspense, useState, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { isActive } from "./lib/premium";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createRoot } from "react-dom/client";
import useTranslation from "./hooks/useTranslation";

import AuroraPopup from "./components/AuroraPopup";
import Header from "./components/Header";
import SearchBox from "./components/SearchBox";
import MidnightSunV2 from "./components/MidnightSunV2";

import { useSearchParams } from "react-router-dom";
import SEO from "./components/SEO";

import {
  createAuroraOverlay,
  fetchAuroraData,
  getAuroraIntensity,
} from "./utils/auroraOverlay";

import { loadSightingsLayer } from "./utils/mapSightings";

const BASE = process.env.REACT_APP_API_BASE || "";

const PREMIUM_POINT_TTL_MS = 60 * 60 * 1000;
const MAP_CLICK_DEBOUNCE_MS = 300;
const SIGHTINGS_REFRESH_MS = 10 * 60 * 1000;

const GlobeView = lazy(() => import("./components/Globeview"));

function readPremium() {
  try {
    const p = JSON.parse(localStorage.getItem("aurora_premium") || "null");
    if (!p || !p.deviceKey || !p.expiresAt) return null;
    if (p.expiresAt < Date.now()) return null;
    return p;
  } catch { return null; }
}

function roundCoord(value, step = 0.25) {
  return Math.round(Number(value) / step) * step;
}

function premiumPointCacheKey(lat, lon, deviceKey) {
  const latKey = roundCoord(lat, 0.25).toFixed(2);
  const lonKey = roundCoord(lon, 0.25).toFixed(2);
  const devicePart = String(deviceKey || "").slice(0, 12);
  return `aurora_session_cache:map:premium-calc:${latKey}:${lonKey}:${devicePart}:v1`;
}

function readSessionCache(key, ttlMs) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached.savedAt !== "number") return null;
    if (ttlMs && Date.now() - cached.savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return cached.data ?? null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function writeSessionCache(key, data) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch { /* storage full */ }
}

async function sessionCachedJson(key, ttlMs, fetcher) {
  const cached = readSessionCache(key, ttlMs);
  if (cached) return cached;
  const data = await fetcher();
  writeSessionCache(key, data);
  return data;
}

async function fetchPremiumAuroraPoint(lat, lon) {
  const premium = readPremium();
  if (!premium?.deviceKey) return null;
  const deviceKey = premium.deviceKey;
  const cacheKey = premiumPointCacheKey(lat, lon, deviceKey);
  return sessionCachedJson(cacheKey, PREMIUM_POINT_TTL_MS, async () => {
    const res = await fetch(`${BASE}/api/aurora/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, deviceKey }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`forecast ${res.status}: ${text.slice(0, 120)}`);
    }
    return res.json();
  });
}

function buildFreePointData(lat, lon) {
  return { tier: "free", ovation: getAuroraIntensity(lat, lon) };
}

export default function MapPage() {
  const mapRef        = useRef(null);
  const mapInstance   = useRef(null);
  const markerRef     = useRef(null);
  const clickTimerRef = useRef(null);
  const hintPopupRef  = useRef(null);
  const popupRootRef  = useRef(null);

  const [searchParams] = useSearchParams();
  const initialLat = parseFloat(searchParams.get("lat")) || 67.5;
  const initialLon = parseFloat(searchParams.get("lon")) || 26;
  const isSighting  = searchParams.get("sighting");

  /* Oletusnäkymä: globe. Poikkeukset:
     - ?view=sun → aurinko (hoidetaan alla efektissä)
     - suora sijaintilinkki (?lat&lon, esim. havainnosta) → 2D-kartta,
       koska markkeri + popup avataan siellä */
  const hasDirectCoords = !!(searchParams.get("lat") && searchParams.get("lon"));
  const [view, setView] = useState(() => (hasDirectCoords ? "map" : "globe"));
  const [sunCoords, setSunCoords] = useState(null);
  const [sunVisible, setSunVisible] = useState(false);

  const auroraIconRef = useRef(
    L.divIcon({
      className: "",
      html: `<div class="map-marker"></div>`,
      iconSize: [14, 14],
    })
  );

  const navigate = useNavigate();
  const { t } = useTranslation();
  const [globeMsg, setGlobeMsg] = useState("");

  useEffect(() => {
    if (searchParams.get("view") === "sun") {
      const lat = parseFloat(searchParams.get("lat"));
      const lon = parseFloat(searchParams.get("lon"));
      if (!isNaN(lat) && !isNaN(lon)) setSunCoords({ lat, lon });
      setView("sun");
      setTimeout(() => setSunVisible(true), 10);
    }
  }, [searchParams]);

  const switchToSun = (lat, lon) => {
    if (lat != null && lon != null) setSunCoords({ lat, lon });
    setView("sun");
    setTimeout(() => setSunVisible(true), 10);
    if (mapInstance.current) mapInstance.current.closePopup();
  };

  const switchToMap = () => {
    setSunVisible(false);
    setTimeout(() => setView("map"), 300);
  };

  const switchToGlobe = () => {
    setSunVisible(false);
    setView("globe");
    if (mapInstance.current) mapInstance.current.closePopup();
  };

  useEffect(() => {
    const setVH = () =>
      document.documentElement.style.setProperty(
        "--vh", `${window.innerHeight * 0.01}px`
      );
    setVH();
    window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const openPopup = useCallback(async (map, lat, lng) => {
    if (!map) return;
    const freeData = buildFreePointData(lat, lng);
    const premium  = readPremium();

    const popup = L.popup({
      maxWidth: 320,
      autoPanPadding: L.point(24, 24),
      className: "aurora-popup-wrap",
      offset: L.point(0, -2),
    }).setLatLng([lat, lng]);

    const container = document.createElement("div");
    popup.setContent(container);
    popup.addTo(map);

    if (popupRootRef.current) {
      try { popupRootRef.current.unmount(); } catch { /* ignore */ }
    }

    const root = createRoot(container);
    popupRootRef.current = root;

    root.render(
      <AuroraPopup
        lat={lat} lng={lng}
        data={freeData}
        premium={!!premium}
        loading={!!premium}
        onSunView={switchToSun}
      />
    );

    if (!premium) return;

    try {
      const premiumData = await fetchPremiumAuroraPoint(lat, lng);
      root.render(
        <AuroraPopup
          lat={lat} lng={lng}
          data={premiumData || freeData}
          premium
          onSunView={switchToSun}
        />
      );
    } catch (err) {
      console.error("[aurora calc]", err);
      root.render(
        <AuroraPopup
          lat={lat} lng={lng}
          data={freeData}
          premium error
          onSunView={switchToSun}
        />
      );
    }
  }, []);

  const schedulePopup = useCallback((map, lat, lng) => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(
      () => openPopup(map, lat, lng),
      MAP_CLICK_DEBOUNCE_MS
    );
  }, [openPopup]);

  // Map init
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([initialLat, initialLon], 9);

    // Tarkistetaan, tullaanko sivulle suoraan jostain tietystä paikasta (URL-parametrit lat & lon löytyvät)
    const directCoords = searchParams.get("lat") && searchParams.get("lon");

    // Ohje-popup VAIN jos sivulle saavutaan yleisesti (ilman valittua paikkaa)
    if (!directCoords) {
      const hintPopup = L.popup({ closeButton: true, autoClose: true, closeOnClick: true })
        .setLatLng([66.5, 25.7])
        .setContent(`
          <div class="map-hint-popup">
            <strong>Explore aurora forecast</strong>
            <p>Tap anywhere on the map to view live aurora probability and conditions.</p>
          </div>
        `)
        .addTo(map);
      hintPopupRef.current = hintPopup;
    }

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    ).addTo(map);

    const overlay = createAuroraOverlay();
    overlay.addTo(map);
    fetchAuroraData().then(d => overlay.setData(d)).catch(console.error);

    const premium = readPremium();
    const sightingsLayer = L.layerGroup().addTo(map);
    let sightingsInterval = null;
    if (premium) {
      loadSightingsLayer(sightingsLayer);
      sightingsInterval = setInterval(
        () => loadSightingsLayer(sightingsLayer),
        SIGHTINGS_REFRESH_MS
      );
    }

    map.on("click", (e) => {
      if (hintPopupRef.current) {
        hintPopupRef.current.remove();
        hintPopupRef.current = null;
      }
      schedulePopup(map, e.latlng.lat, e.latlng.lng);
    });
    mapInstance.current = map;

    if (directCoords) {
      map.setView([initialLat, initialLon], isSighting ? 11 : 7);
      schedulePopup(map, initialLat, initialLon);
      const marker = L.marker([initialLat, initialLon], {
        icon: auroraIconRef.current,
      }).addTo(map);
      markerRef.current = marker;
      setTimeout(() => {
        const el = marker.getElement();
        if (el?.firstChild)
          el.firstChild.classList.add(isSighting ? "map-marker-sighting" : "map-marker-active");
      }, 0);
    }

    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (sightingsInterval) clearInterval(sightingsInterval);
      if (popupRootRef.current) {
        try { popupRootRef.current.unmount(); } catch { /* ignore */ }
      }
      map.remove();
      mapInstance.current = null;
    };
  }, [initialLat, initialLon, isSighting, schedulePopup, searchParams]);

  const handleSearchSelect = (place) => {
    const map = mapInstance.current;
    if (!map) return;
    const { lat, lon } = place;
    map.flyTo([lat, lon], 7, { duration: 1.5 });
    if (markerRef.current) markerRef.current.remove();
    const marker = L.marker([lat, lon], { icon: auroraIconRef.current }).addTo(map);
    markerRef.current = marker;
    setTimeout(() => {
      const el = marker.getElement();
      if (el?.firstChild) el.firstChild.classList.add("map-marker-active");
    }, 0);
    schedulePopup(map, lat, lon);
  };

  return (
    <div className="map-page">
      <SEO
        title="Northern Lights Map Finland | RepoTracker"
        description="Interactive Northern Lights map showing current northern lights conditions across Finland."
        keywords="aurora map, northern lights map Finland"
        canonical="https://repotracker.fi/map"
      />

      <Header />

      {view === "map" && (
        <div className="map-search-wrap">
          <SearchBox onSelect={handleSearchSelect} />
        </div>
      )}

      <div
        id="map"
        ref={mapRef}
        className={view !== "map" ? "map--hidden" : ""}
      />

      {view === "sun" && (
        <div className={`map-sun-panel ${sunVisible ? "map-sun-panel--visible" : ""}`}>
          <MidnightSunV2
            lat={sunCoords?.lat}
            lon={sunCoords?.lon}
          />
        </div>
      )}

      {view === "globe" && (
        <Suspense fallback={<div className="globe-loading">{t("globe.loading") || "Loading globe…"}</div>}>
          <GlobeView
            premium={isActive()}
            onUpgrade={() => navigate("/premium")}
            onFallback={(reason) => {
              switchToMap();
              setGlobeMsg(
                reason === "timeout"
                  ? (t("globe.tooSlow") || "3D globe is taking too long — showing the 2D map.")
                  : (t("globe.unsupported") || "3D globe isn't available on this device — showing the 2D map.")
              );
              setTimeout(() => setGlobeMsg(""), 6000);
            }}
          />
        </Suspense>
      )}

      {globeMsg && <div className="globe-fallback-toast">{globeMsg}</div>}

      {/* Näkymäpalkki: Globe ensin (oletus), sitten 2D-kartta, aurinko viimeisenä */}
      <div className="map-view-toggle">
        <button
          className={`map-toggle-btn ${view === "globe" ? "map-toggle-btn--active" : ""}`}
          onClick={switchToGlobe}
        >
          🌍 {t("globe.toggle") || "Globe"}
        </button>
        <button
          className={`map-toggle-btn ${view === "map" ? "map-toggle-btn--active" : ""}`}
          onClick={switchToMap}
        >
          🌌 Aurora 2D
        </button>
        <button
          className={`map-toggle-btn ${view === "sun" ? "map-toggle-btn--active" : ""}`}
          onClick={() => switchToSun(null, null)}
        >
          ☀️ Sun &amp; night
        </button>
      </div>
    </div>
  );
}