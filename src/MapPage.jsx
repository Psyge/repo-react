import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createRoot } from "react-dom/client";

import AuroraPopup from "./components/AuroraPopup";
import Header from "./components/Header";
import useTranslation from "./hooks/useTranslation";
import SearchBox from "./components/SearchBox";
import { useSearchParams } from "react-router-dom";

import {
  createAuroraOverlay,
  fetchAuroraData,
  getAuroraIntensity,
} from "./utils/auroraOverlay";

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

const initialLat =
  parseFloat(searchParams.get("lat")) || 67.5;

const initialLon =
  parseFloat(searchParams.get("lon")) || 26;
  const BASE = "https://report.masto84.workers.dev";

  // ===== API =====
  const fetchAuroraPoint = async (lat, lon) => {
    try {
      const res = await fetch(`${BASE}/api/aurora/calc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lat, lon }),
      });

      if (!res.ok) throw new Error("fail");

      return await res.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // ===== 🔥 POPUP (yksi source of truth)
  const openPopup = useCallback(async (map, lat, lng) => {
    if (!map) return;

    const popup = L.popup().setLatLng([lat, lng]);

    const container = document.createElement("div");
    popup.setContent(container);
    popup.openOn(map);

    const root = createRoot(container);

    // loading
    root.render(
      <AuroraPopup lat={lat} lng={lng} prob={null} intensity={null} />
    );

    try {
      const data = await fetchAuroraPoint(lat, lng);

      const apiProb = data?.probability ?? 0;
      const intensity = getAuroraIntensity(lat, lng);
      const finalProb = Math.max(apiProb, intensity);

      root.render(
        <AuroraPopup
          lat={lat}
          lng={lng}
          prob={finalProb}
          intensity={intensity}
        />
      );
    } catch (err) {
      console.error(err);

      root.render(
        <AuroraPopup
          lat={lat}
          lng={lng}
          prob={0}
          intensity={0}
        />
      );
    }
  }, []);

  // ===== INIT MAP
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current).setView(
  [initialLat, initialLon],
  9
);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    ).addTo(map);

    // ===== AURORA OVERLAY
    const overlay = createAuroraOverlay();
    overlay.addTo(map);

    const loadAurora = async () => {
      try {
        const data = await fetchAuroraData();
        overlay.setData(data);
      } catch (e) {
        console.error(e);
      }
    };

    loadAurora();
    const interval = setInterval(loadAurora, 60000);

    // CLICK
    map.on("click", (e) => {
      openPopup(map, e.latlng.lat, e.latlng.lng);
    });

    mapInstance.current = map;
if (searchParams.get("lat") && searchParams.get("lon")) {
  openPopup(map, initialLat, initialLon);

  const marker = L.marker([initialLat, initialLon], {
    icon: auroraIcon,
  }).addTo(map);

  markerRef.current = marker;

  setTimeout(() => {
    const el = marker.getElement();

    if (el && el.firstChild) {
      el.firstChild.classList.add("map-marker-active");
    }
  }, 0);
}
    return () => {
      clearInterval(interval);
    };
  }, [
  openPopup,
  initialLat,
  initialLon,
  auroraIcon,
  searchParams,
]);
  
  const auroraIcon = L.divIcon({
  className: "",
  html: `<div class="map-marker"></div>`,
  iconSize: [14, 14],
});
  // ===== 🔍 SEARCH HANDLER
  const handleSearchSelect = (place) => {
  const map = mapInstance.current;
  if (!map) return;

  const { lat, lon } = place;

  // 🔥 smooth zoom
  map.flyTo([lat, lon], 7, {
    duration: 1.5,
  });

  // ❌ poista vanha marker
  if (markerRef.current) {
    markerRef.current.remove();
  }

  // 🔥 uusi marker (CSS-pohjainen)
  const marker = L.marker([lat, lon], {
    icon: auroraIcon,
  }).addTo(map);

  markerRef.current = marker;

  // 🔥 highlight efekti (CSS)
  setTimeout(() => {
    const el = marker.getElement();
    if (el && el.firstChild) {
      el.firstChild.classList.add("map-marker-active");
    }
  }, 0);

  // 🔥 popup
  openPopup(map, lat, lon);
};

  return (
    <div>
      <Header />

      {/* 🔍 SEARCH */}
      <div
        style={{
          position: "absolute",
          top: "80px",
          left: "20px",
          zIndex: 1000,
          width: "300px",
        }}
      >
        <SearchBox onSelect={handleSearchSelect} />
      </div>

      {/* UX hint */}
      <div className="map-hint">
        {t("map.click_hint")}
      </div>

      <div
        ref={mapRef}
        style={{
          height: "100vh",
          width: "100%",
        }}
      />
    </div>
  );
}