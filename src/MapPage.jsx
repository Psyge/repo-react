import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createRoot } from "react-dom/client";

import AuroraPopup from "./components/AuroraPopup";
import Header from "./components/Header";
import SearchBox from "./components/SearchBox";

import { useSearchParams } from "react-router-dom";

import {
  createAuroraOverlay,
  fetchAuroraData,
} from "./utils/auroraOverlay";

import {
  loadSightingsLayer,
} from "./utils/mapSightings";

const BASE = "https://report.masto84.workers.dev";

function readPremium() {
  try {
    const p = JSON.parse(
      localStorage.getItem("aurora_premium") || "null"
    );
    if (!p || !p.deviceKey || !p.expiresAt) return null;
    if (p.expiresAt < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export default function MapPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  // auroraIcon useRef:iin — ei luo uutta objektia joka renderillä
  const auroraIconRef = useRef(
    L.divIcon({
      className: "",
      html: `<div class="map-marker"></div>`,
      iconSize: [14, 14],
    })
  );

  const [searchParams] = useSearchParams();

  const initialLat = parseFloat(searchParams.get("lat")) || 67.5;
  const initialLon = parseFloat(searchParams.get("lon")) || 26;
  const isSighting = searchParams.get("sighting");

  // ===== MOBILE VIEWPORT
  useEffect(() => {
    const setVH = () => {
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`
      );
    };
    setVH();
    window.addEventListener("resize", setVH);
    return () => window.removeEventListener("resize", setVH);
  }, []);

  // ===== DISABLE BODY SCROLL
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const fetchAuroraPoint = async (lat, lon) => {
    const p = readPremium();
    const deviceKey = p?.deviceKey || "";
    const res = await fetch(`${BASE}/api/aurora/calc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, deviceKey }),
    });
    if (!res.ok) throw new Error(`calc ${res.status}`);
    return res.json();
  };

  // ===== POPUP
  const openPopup = useCallback(async (map, lat, lng) => {
    if (!map) return;

    const popup = L.popup({
      maxWidth: 320,
      autoPanPadding: L.point(24, 24),
      className: "aurora-popup-wrap",
    }).setLatLng([lat, lng]);

    const container = document.createElement("div");
    popup.setContent(container);
    popup.addTo(map);

    const root = createRoot(container);
    root.render(<AuroraPopup lat={lat} lng={lng} data={null} />);

    try {
      const data = await fetchAuroraPoint(lat, lng);
      root.render(<AuroraPopup lat={lat} lng={lng} data={data} />);
    } catch (err) {
      console.error("[aurora calc]", err);
      root.render(<AuroraPopup lat={lat} lng={lng} data={null} error />);
    }
  }, []);

  // ===== MAP INIT
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([initialLat, initialLon], 9);

    // Mobile hint
    
      L.popup({
        closeButton: true,
        autoClose: true,
        closeOnClick: true,  // korjattu: ei enää estä kartan klikkausta
      })
        .setLatLng([64.8, 26])
        .setContent(`
          <div class="map-hint-popup">
            <strong>Explore aurora forecast</strong>
            <p>Tap anywhere on the map to view live aurora probability and conditions.</p>
          </div>
        `)
        .addTo(map);
    

    // Tile
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    ).addTo(map);

    // Aurora overlay
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
    const auroraInterval = setInterval(loadAurora, 60000);

    // Sightings
    const premium = readPremium();
    const sightingsLayer = L.layerGroup().addTo(map);
    let sightingsInterval = null;

    if (premium) {
      loadSightingsLayer(sightingsLayer);
      sightingsInterval = setInterval(() => {
        loadSightingsLayer(sightingsLayer);
      }, 60000);
    }

    // Click — avaa popup ja sulkee vanhan automaattisesti
    map.on("click", (e) => {
      openPopup(map, e.latlng.lat, e.latlng.lng);
    });

    mapInstance.current = map;

    // URL-parametrit → avaa popup ja markeri
    if (searchParams.get("lat") && searchParams.get("lon")) {
      map.flyTo([initialLat, initialLon], isSighting ? 11 : 7, { duration: 1.5 });
      openPopup(map, initialLat, initialLon);

      const marker = L.marker([initialLat, initialLon], {
        icon: auroraIconRef.current,
      }).addTo(map);
      markerRef.current = marker;

      setTimeout(() => {
        const el = marker.getElement();
        if (el && el.firstChild) {
          el.firstChild.classList.add(
            isSighting ? "map-marker-sighting" : "map-marker-active"
          );
        }
      }, 0);

    } 

    return () => {
      clearInterval(auroraInterval);
      if (sightingsInterval) clearInterval(sightingsInterval);
      map.remove();
    };
  }, [openPopup, initialLat, initialLon, searchParams, isSighting]);
  // ↑ auroraIcon poistettu dependency listasta

  // ===== SEARCH
  const handleSearchSelect = (place) => {
    const map = mapInstance.current;
    if (!map) return;

    const { lat, lon } = place;
    map.flyTo([lat, lon], 7, { duration: 1.5 });

    if (markerRef.current) markerRef.current.remove();

    const marker = L.marker([lat, lon], {
      icon: auroraIconRef.current,
    }).addTo(map);
    markerRef.current = marker;

    setTimeout(() => {
      const el = marker.getElement();
      if (el && el.firstChild) {
        el.firstChild.classList.add("map-marker-active");
      }
    }, 0);

    openPopup(map, lat, lon);
  };

  return (
    <div>
      <Header />
      <div className="map-search-wrap">
        <SearchBox onSelect={handleSearchSelect} />
      </div>
      <div id="map" ref={mapRef} />
    </div>
  );
}