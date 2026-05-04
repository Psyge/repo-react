import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createRoot } from "react-dom/client";
import AuroraPopup from "./components/AuroraPopup";
import Header from "./components/Header";
import Hero from "./components/Hero";

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const [kp, setKp] = useState(0);
  const [probability, setProbability] = useState("🔒");

  const BASE = "https://report.masto84.workers.dev";

  // ===== API =====
  const fetchAuroraData = async (lat, lon) => {
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

  const fetchSolar = async () => {
    try {
      const res = await fetch(`${BASE}/api/solar`);
      const data = await res.json();

      setKp(data.kp ?? 0);
      setProbability("🔒");
    } catch (e) {
      console.error(e);
    }
  };

  // ===== INIT MAP =====
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current).setView([67.5, 26], 5);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    ).addTo(map);

    // click anywhere
    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;

      // 🔥 luo popup + container
      const popup = L.popup().setLatLng(e.latlng);

      const container = document.createElement("div");
      popup.setContent(container);

      popup.openOn(map);

      // 🔥 render React popup (loading state)
      const root = createRoot(container);
      root.render(
        <AuroraPopup lat={lat} lng={lng} prob={0} />
      );

      // 🔁 hae data
      const data = await fetchAuroraData(lat, lng);

      // 🔥 päivitä popup Reactilla
      root.render(
        <AuroraPopup
          lat={lat}
          lng={lng}
          prob={data?.probability ?? 0}
        />
      );
    });

    mapInstance.current = map;

    fetchSolar();
    const interval = setInterval(fetchSolar, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
  <div>
    <Header />
    <Hero kp={kp} />

    <div
      ref={mapRef}
      style={{
        height: "80vh",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    />
  </div>
);
}