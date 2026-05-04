import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createRoot } from "react-dom/client";

import AuroraPopup from "./components/AuroraPopup";
import Header from "./components/Header";

import {
  createAuroraOverlay,
  fetchAuroraData,
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

  // ===== INIT MAP =====
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current).setView([67.5, 26], 5);

    // 🔥 taustakartta
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    ).addTo(map);

    // 🔥 AURORA OVERLAY
    const overlay = createAuroraOverlay();
    overlay.addTo(map);

    // 🔥 hae aurora data heti
    fetchAuroraData()
      .then((data) => {
        overlay.setData(data);
      })
      .catch(console.error);

    // 🔁 päivitä 60s välein
    const interval = setInterval(async () => {
      try {
        const data = await fetchAuroraData();
        overlay.setData(data);
      } catch (e) {
        console.error(e);
      }
    }, 60000);

    // ===== CLICK POPUP =====
    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;

      const popup = L.popup().setLatLng(e.latlng);

      const container = document.createElement("div");
      popup.setContent(container);
      popup.openOn(map);

      const root = createRoot(container);

      // loading
      root.render(
        <AuroraPopup lat={lat} lng={lng} prob={0} />
      );

      const data = await fetchAuroraPoint(lat, lng);

      root.render(
        <AuroraPopup
          lat={lat}
          lng={lng}
          prob={data?.probability ?? 0}
        />
      );
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