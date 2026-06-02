import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import places from "../data/places";
import useTranslation from "../hooks/useTranslation";

const NOAA_KP_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

const KP_CACHE_KEY = "aurora_session_cache:places:kp:v1";
const KP_TTL_MS = 30 * 60 * 1000;

const WEATHER_TTL_MS = 60 * 60 * 1000;

function kpClass(kp) {
  if (kp == null) return "";
  if (kp >= 5) return "kp-high";
  if (kp >= 3) return "kp-mid";
  return "kp-low";
}

function roundCoord(value, step = 0.25) {
  return Math.round(Number(value) / step) * step;
}

function weatherCacheKey(lat, lon) {
  const latKey = roundCoord(lat, 0.25).toFixed(2);
  const lonKey = roundCoord(lon, 0.25).toFixed(2);

  return `aurora_session_cache:places:weather:${latKey}:${lonKey}:v1`;
}

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
    // sessionStorage voi olla täynnä/estetty — ei kaadeta sivua.
  }
}

async function sessionCachedJson(key, ttlMs, fetcher) {
  const cached = readSessionCache(key, ttlMs);
  if (cached) return cached;

  const data = await fetcher();
  writeSessionCache(key, data);

  return data;
}

async function fetchJsonSafe(url, label) {
  const res = await fetch(url, {
    cache: "default",
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${label} ${res.status}: ${text.slice(0, 120)}`);
  }

  if (!text.trim()) {
    throw new Error(`${label}: empty response`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: invalid JSON`);
  }
}

function lastValidRow(rows, colIndex) {
  if (!Array.isArray(rows)) return null;

  for (let i = rows.length - 1; i >= 1; i--) {
    const value = parseFloat(rows[i]?.[colIndex]);

    if (!Number.isNaN(value)) {
      return rows[i];
    }
  }

  return null;
}

async function fetchCurrentKp() {
  return sessionCachedJson(KP_CACHE_KEY, KP_TTL_MS, async () => {
    const kpRows = await fetchJsonSafe(NOAA_KP_URL, "NOAA Kp");
    const kpLast = lastValidRow(kpRows, 1);
    const parsedKp = kpLast ? parseFloat(kpLast[1]) : null;

    return {
      kp: Number.isNaN(parsedKp) ? null : parsedKp,
      fetchedAt: Date.now(),
    };
  });
}

async function fetchOpenMeteoCurrent(lat, lon) {
  const key = weatherCacheKey(lat, lon);

  return sessionCachedJson(key, WEATHER_TTL_MS, async () => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");

    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set(
      "current",
      "temperature_2m,cloud_cover,wind_speed_10m"
    );
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url, {
      cache: "default",
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo ${res.status}`);
    }

    const data = await res.json();
    const current = data.current || {};

    return {
      temp:
        current.temperature_2m != null
          ? Math.round(current.temperature_2m)
          : null,
      clouds:
        current.cloud_cover != null
          ? Math.round(current.cloud_cover)
          : null,
      wind:
        current.wind_speed_10m != null
          ? Math.round(current.wind_speed_10m * 10) / 10
          : null,
      fetchedAt: Date.now(),
    };
  });
}

export default function PlacesSection({ kp: kpProp = null }) {
  const [placeData, setPlaceData] = useState({});
  const [randomPlaces, setRandomPlaces] = useState([]);
  const [localKp, setLocalKp] = useState(kpProp);

  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const shuffled = [...places]
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    setRandomPlaces(shuffled);
  }, []);

  useEffect(() => {
    if (kpProp != null) {
      setLocalKp(kpProp);
      return;
    }

    let cancelled = false;

    async function loadKp() {
      try {
        const data = await fetchCurrentKp();

        if (!cancelled) {
          setLocalKp(data.kp);
        }
      } catch (e) {
        console.warn("[places] kp failed", e);
      }
    }

    loadKp();

    return () => {
      cancelled = true;
    };
  }, [kpProp]);

  useEffect(() => {
    if (randomPlaces.length === 0) return;

    let cancelled = false;

    const fetchPlaces = async () => {
      try {
        const results = await Promise.all(
          randomPlaces.map(async (place) => {
            try {
              const weather = await fetchOpenMeteoCurrent(
                place.lat,
                place.lon
              );

              return {
                id: place.id,
                kp: localKp ?? null,
                temp: weather.temp,
                clouds: weather.clouds,
                wind: weather.wind,
              };
            } catch (err) {
              console.warn(`[places] ${place.id} failed`, err);

              return {
                id: place.id,
                kp: localKp ?? null,
                temp: null,
                clouds: null,
                wind: null,
              };
            }
          })
        );

        if (cancelled) return;

        const mapped = {};

        results.forEach((r) => {
          mapped[r.id] = r;
        });

        setPlaceData(mapped);
      } catch (e) {
        console.error(e);
      }
    };

    fetchPlaces();

    return () => {
      cancelled = true;
    };
  }, [randomPlaces, localKp]);

  return (
    <section className="container">
      <h2>{t("locations.title")}</h2>
      <p>{t("locations.sub")}</p>

      <div className="places-grid">
        {randomPlaces.map((place) => {
          const data = placeData[place.id];

          return (
            <div
              key={place.id}
              className="place-row"
              onClick={() =>
                navigate(`/map?lat=${place.lat}&lon=${place.lon}`)
              }
              style={{ cursor: "pointer" }}
            >
              <div className="place-name">{place.name}</div>

              <div className="data-group">
                <div className="data-item">
                  <span className="label">KP</span>

                  <span className={`value kp-val ${kpClass(data?.kp)}`}>
                    {data != null ? data.kp ?? "--" : "--"}
                  </span>
                </div>

                <div className="data-item">
                  <span className="label">
                    {t("weather.clouds")}
                  </span>

                  <span className="value">
                    {data?.clouds != null
                      ? `${data.clouds}%`
                      : "--"}
                  </span>
                </div>

                <div className="data-item">
                  <span className="label">
                    {t("weather.temp")}
                  </span>

                  <span className="value">
                    {data?.temp != null
                      ? `${data.temp}°`
                      : "--"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}