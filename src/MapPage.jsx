import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createRoot } from "react-dom/client";

import AuroraPopup from "./components/AuroraPopup";
import Header from "./components/Header";

import {
  createAuroraOverlay,
  fetchAuroraData,
  getAuroraIntensity,
} from "./utils/auroraOverlay";

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const BASE = "https://report.masto84.workers.dev";

  // ===== API (popup varten) =====
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

  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current).setView([67.5, 26], 5);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    ).addTo(map);

    // ===== AURORA OVERLAY =====
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

    // initial load
    loadAurora();

    // refresh loop
    const interval = setInterval(loadAurora, 60000);

    // ===== CLICK POPUP =====
    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;

      const popup = L.popup().setLatLng(e.latlng);

      const container = document.createElement("div");
      popup.setContent(container);
      popup.openOn(map);

      const root = createRoot(container);

      // 🔄 loading state
      root.render(
        <AuroraPopup lat={lat} lng={lng} prob={null} intensity={null} />
      );

      try {
        // 🔥 hae molemmat
        const [data] = await Promise.all([
          fetchAuroraPoint(lat, lng),
        ]);

        const apiProb = data?.probability ?? 0;
        const intensity = getAuroraIntensity(lat, lng);

        // 🔥 yhdistetty paras arvo
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
    });

    mapInstance.current = map;

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <Header />

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