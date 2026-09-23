import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Header from "./components/Header";
import SearchBox from "./components/SearchBox";
import MidnightSunV2 from "./components/MidnightSunV2";
import AuroraPopup from "./components/AuroraPopup";
import SEO from "./components/SEO";
import useTranslation from "./hooks/useTranslation";
import places from "./data/places";
import { createAuroraOverlay, fetchAuroraData, getAuroraIntensity } from "./utils/auroraOverlay";
import { loadSightingsLayer } from "./utils/mapSightings";

const BASE = process.env.REACT_APP_API_BASE || "";
const FREE_TTL = 10 * 60 * 1000;
const PREMIUM_TTL = 60 * 60 * 1000;
const SIGHTINGS_REFRESH = 10 * 60 * 1000;

function readPremium() {
  try {
    const saved = JSON.parse(localStorage.getItem("aurora_premium") || "null");
    return saved?.deviceKey && saved.expiresAt > Date.now() ? saved : null;
  } catch { return null; }
}

function cacheKey(lat, lon, premium) {
  const rounded = (value) => (Math.round(value * 4) / 4).toFixed(2);
  return `aurora_session_cache:map:${premium ? `premium:${premium.deviceKey.slice(0, 12)}` : "free"}:${rounded(lat)}:${rounded(lon)}:v1`;
}

async function fetchPoint(lat, lon, premium) {
  const key = cacheKey(lat, lon, premium);
  const ttl = premium ? PREMIUM_TTL : FREE_TTL;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    if (saved && Date.now() - saved.at < ttl) return saved.data;
  } catch { /* cache is optional */ }
  const res = await fetch(`${BASE}${premium ? "/api/aurora/forecast" : "/api/aurora/calc"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, ...(premium ? { deviceKey: premium.deviceKey } : {}) }),
  });
  if (!res.ok) throw new Error(`Aurora point ${res.status}`);
  const data = await res.json();
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* optional cache */ }
  return data;
}

export default function MapPage() {
  const [searchParams] = useSearchParams();
  const { currentLanguage } = useTranslation();
  const fi = currentLanguage !== "en";
  const initialLat = Number(searchParams.get("lat"));
  const initialLon = Number(searchParams.get("lon"));
  const hasDirectCoords = searchParams.has("lat") && searchParams.has("lon") &&
    Number.isFinite(initialLat) && Number.isFinite(initialLon) &&
    Math.abs(initialLat) <= 90 && Math.abs(initialLon) <= 180;
  const initialPoint = hasDirectCoords
    ? { lat: initialLat, lon: initialLon, name: places.find((p) => Math.abs(p.lat - initialLat) < 0.01 && Math.abs(p.lon - initialLon) < 0.01)?.name }
    : places[0];
  const [view, setView] = useState(searchParams.get("view") === "sun" ? "sun" : "map");
  const [selected, setSelected] = useState(initialPoint);
  const [pointData, setPointData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sightingCluster, setSightingCluster] = useState(null);
  const mapNode = useRef(null);
  const mapInstance = useRef(null);
  const selectedMarker = useRef(null);
  const requestSeq = useRef(0);
  const clickTimer = useRef(null);
  const selectRef = useRef(null);

  const selectPoint = useCallback((point, fly = false, keepView = false) => {
    const lat = Number(point?.lat);
    const lon = Number(point?.lon ?? point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const next = { lat, lon, name: point?.name || "" };
    setSelected(next);
    setSightingCluster(null);
    if (!keepView) setView("map");
    const map = mapInstance.current;
    if (map) {
      if (fly) map.flyTo([lat, lon], Math.max(map.getZoom(), 7), { duration: 1.2 });
      if (!selectedMarker.current) {
        selectedMarker.current = L.circleMarker([lat, lon], {
          radius: 8, color: "#f1ffdf", weight: 2, fillColor: "#8af7bb",
          fillOpacity: 1, interactive: false, className: "rt-selected-marker",
        }).addTo(map);
      } else selectedMarker.current.setLatLng([lat, lon]);
    }
    setLoading(true);
    setError(false);
    setPointData({ tier: "free", ovation: getAuroraIntensity(lat, lon) });
    if (clickTimer.current) clearTimeout(clickTimer.current);
    const seq = ++requestSeq.current;
    clickTimer.current = setTimeout(async () => {
      try {
        const data = await fetchPoint(lat, lon, readPremium());
        if (seq === requestSeq.current) setPointData(data);
      } catch (err) {
        console.error("[map point]", err);
        if (seq === requestSeq.current) setError(true);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 250);
  }, []);
  selectRef.current = selectPoint;

  useEffect(() => {
    if (mapInstance.current || !mapNode.current) return;
    const map = L.map(mapNode.current, { zoomControl: true, zoomAnimation: false })
      .setView(hasDirectCoords ? [initialLat, initialLon] : [65.6, 25.7],
        hasDirectCoords ? (searchParams.get("sighting") ? 11 : 7) : 5);
    mapInstance.current = map;
    const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
    L.tileLayer(`${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
      maxZoom: 16,
      attribution: 'Tiles © <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> · Data: <a href="https://en.ilmatieteenlaitos.fi/open-data" target="_blank" rel="noopener noreferrer">Ilmatieteen laitos</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>) · NOAA SWPC',
    }).addTo(map);
    L.tileLayer(`${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16 }).addTo(map);
    const overlay = createAuroraOverlay();
    overlay.addTo(map);
    fetchAuroraData().then((data) => overlay.setData(data)).catch((err) => console.error("[aurora overlay]", err));
    places.forEach((place) => {
      const marker = L.circleMarker([place.lat, place.lon], {
        radius: 5, color: "#dcfff0", weight: 2, fillColor: "#4ee4af", fillOpacity: .9,
        bubblingMouseEvents: false,
      }).addTo(map);
      marker.bindTooltip(place.name, { direction: "top" });
      marker.on("click", () => selectRef.current(place));
    });
    const sightings = L.layerGroup().addTo(map);
    let sightingsTimer = null;
    if (readPremium()) {
      const refresh = () => {
        if (document.visibilityState === "visible") loadSightingsLayer(sightings, {
          onSelect: (cluster) => {
            selectRef.current({ lat: cluster.lat, lon: cluster.lon, name: cluster.region });
            setSightingCluster(cluster);
          },
        });
      };
      refresh();
      sightingsTimer = setInterval(refresh, SIGHTINGS_REFRESH);
    }
    map.on("click", (event) => selectRef.current({ lat: event.latlng.lat, lon: event.latlng.lng }));
    selectRef.current(initialPoint, false, true);
    const resize = () => map.invalidateSize();
    window.addEventListener("resize", resize);
    const frame = requestAnimationFrame(resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      if (sightingsTimer) clearInterval(sightingsTimer);
      if (clickTimer.current) clearTimeout(clickTimer.current);
      requestSeq.current += 1;
      map.remove();
      mapInstance.current = null;
      selectedMarker.current = null;
    };
    // The Leaflet instance mounts once; selectRef keeps its click handler current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view !== "map" || !mapInstance.current) return;
    const frame = requestAnimationFrame(() => mapInstance.current?.invalidateSize());
    return () => cancelAnimationFrame(frame);
  }, [view]);

  return (
    <div className="map-page rt-map-page">
      <SEO
  title="Northern Lights Map Finland | RepoTracker"
  description="Explore current northern lights conditions across Finland with RepoTracker's interactive aurora forecast map."
  keywords="northern lights map Finland, aurora map Finland, aurora forecast Finland"
  canonical="https://repotracker.fi/map"
  image="https://repotracker.fi/images/reposet.png"
  language="en"
  locale="en_US"
/>
      <Header />
      <div className="map-seo-intro sr-only">
        <h1>Northern Lights Map Finland</h1>
        <p>
          Explore current aurora conditions across Finland using the
          interactive 2D map or globe.
        </p>
      </div>
      <main className="rt-map-main">
        <div className="rt-map-heading">
          <div>
            <span className="rt-kicker">{fi ? "REVONTULIKARTTA" : "AURORA MAP"}</span>
            <h2>{fi ? "Revontulitilanne Suomessa" : "Northern lights across Finland"}</h2>
            <p>{fi ? "Valitse paikka kartalta tai hae oma sijaintisi. Tiedot päivittyvät oikealle." : "Select a point on the map or search for a place. Its details appear on the right."}</p>
          </div>
          <div className="rt-map-tabs" role="tablist" aria-label={fi ? "Karttanäkymä" : "Map view"}>
            <button type="button" role="tab" aria-selected={view === "map"} className={view === "map" ? "is-active" : ""} onClick={() => setView("map")}>{fi ? "Revontulet" : "Aurora"}</button>
            <button type="button" role="tab" aria-selected={view === "sun"} className={view === "sun" ? "is-active" : ""} onClick={() => setView("sun")}>{fi ? "Aurinko ja yö" : "Sun & night"}</button>
          </div>
        </div>
        <div className="rt-map-layout">
          <div className={`rt-map-stage ${view === "sun" ? "rt-map-stage--sun" : ""}`}>
            <div id="map" ref={mapNode} className={`rt-map-canvas ${view !== "map" ? "rt-map-hidden" : ""}`} aria-label={fi ? "Suomen revontulikartta" : "Aurora map of Finland"} />
            {view === "sun" && <div className="rt-sun-stage"><MidnightSunV2 lat={selected?.lat} lon={selected?.lon} /></div>}
            {view === "map" && <div className="rt-map-caption">{fi ? "Klikkaa karttaa nähdäksesi paikan olosuhteet" : "Click the map to see local conditions"}</div>}
          </div>
          <aside className="rt-map-side">
            <div className="rt-map-side-head" aria-live="polite">
              <span className="rt-kicker">{fi ? "VALITTU PAIKKA" : "SELECTED PLACE"}</span>
              <h3>{selected?.name || (fi ? "Valittu piste" : "Selected point")}</h3>
              <p>{selected?.lat?.toFixed(2)}° N · {selected?.lon?.toFixed(2)}° E</p>
            </div>
            <div className="rt-search-block">
              <label htmlFor="rt-map-search">{fi ? "Hae paikkakunta" : "Search for a place"}</label>
              <SearchBox onSelect={(place) => selectPoint(place, view === "map", view === "sun")} inputId="rt-map-search" />
            </div>
            {view === "map" ? <div className="rt-detail" key={`${selected?.lat}:${selected?.lon}`}>
              {sightingCluster && <div className="rt-sighting-info">
                <strong>{fi ? "Viimeaikaisia havaintoja" : "Recent sightings"}</strong>
                <span>{sightingCluster.count} {fi ? "ilmoitusta" : "reports"} · {sightingCluster.minutesAgo} min</span>
              </div>}
              <AuroraPopup lat={selected.lat} lng={selected.lon} data={pointData} loading={loading} error={error} premium={!!readPremium()} />
            </div> : <p className="rt-sun-help">{fi ? "Valitse paikka nähdäksesi sen auringon ja yön rytmin." : "Choose a place to see its sun and night cycle."}</p>}
            <div className="rt-nearby">
              <h4>{fi ? "Valitse paikkakunta" : "Choose a place"}</h4>
              <div className="rt-nearby-list">
                {places.filter((p) => ["rovaniemi", "levi", "saariselka", "inari", "yllas", "utsjoki"].includes(p.id)).map((place) => (
                  <button type="button" key={place.id} className={selected?.name === place.name ? "is-active" : ""} onClick={() => selectPoint(place, view === "map", view === "sun")}>
                    <span>{place.name}</span><span aria-hidden="true">↗</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
