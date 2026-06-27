import L from "leaflet";

const BASE = import.meta.env.VITE_API_BASE || "";

const SIGHTINGS_CACHE_KEY = "aurora_session_cache:sightings:clusters:v1";
const SIGHTINGS_TTL_MS = 10 * 60 * 1000; // 10 min

function readSessionCache(key, ttlMs) {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const cached = JSON.parse(raw);

    if (!cached || typeof cached.savedAt !== "number") {
      return null;
    }

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
    sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      })
    );
  } catch {
    // sessionStorage voi olla täynnä tai estetty — ei kaadeta karttaa.
  }
}

async function fetchSightingsClusters({ force = false } = {}) {
  if (!force) {
    const cached = readSessionCache(SIGHTINGS_CACHE_KEY, SIGHTINGS_TTL_MS);
    if (cached) return cached;
  }

  const res = await fetch(`${BASE}/api/sightings/clusters`, {
    cache: "default",
  });

  if (!res.ok) {
    throw new Error(`sightings ${res.status}`);
  }

  const data = await res.json();

  writeSessionCache(SIGHTINGS_CACHE_KEY, data);

  return data;
}

export async function loadSightingsLayer(layer, { force = false } = {}) {
  try {
    const data = await fetchSightingsClusters({ force });

    layer.clearLayers();

    (data.clusters || []).forEach((c) => {
      if (
        c.lat == null ||
        c.lon == null
      ) {
        return;
      }

      const marker = L.circleMarker(
        [c.lat, c.lon],
        {
          radius: 18,

          color: "#ff4d6d",
          weight: 2,

          fillColor: "#ff4d6d",
          fillOpacity: 0.28,
        }
      );

      marker.bindPopup(`
        <div style="min-width:140px">
          <strong>${c.region}</strong><br/>
          ${c.count} reports<br/>
          ${c.minutesAgo} min ago
        </div>
      `);

      marker.addTo(layer);
    });
  } catch (err) {
    console.error(
      "[sightings layer]",
      err
    );
  }
}