import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import places from "../data/places";
import useTranslation from "../hooks/useTranslation";
import { client } from "../lib/contentfulClient";

const NOAA_KP_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

const KP_CACHE_KEY   = "aurora_session_cache:places:kp:v1";
const KP_TTL_MS      = 30 * 60 * 1000;
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
  return `aurora_session_cache:places:weather:${roundCoord(lat).toFixed(2)}:${roundCoord(lon).toFixed(2)}:v1`;
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

function lastValidRow(rows, colIndex) {
  if (!Array.isArray(rows)) return null;
  for (let i = rows.length - 1; i >= 1; i--) {
    const value = parseFloat(rows[i]?.[colIndex]);
    if (!Number.isNaN(value)) return rows[i];
  }
  return null;
}

async function fetchCurrentKp() {
  return sessionCachedJson(KP_CACHE_KEY, KP_TTL_MS, async () => {
    const res  = await fetch(NOAA_KP_URL, { cache: "default" });
    const rows = await res.json();
    const last = lastValidRow(rows, 1);
    const kp   = last ? parseFloat(last[1]) : null;
    return { kp: Number.isNaN(kp) ? null : kp, fetchedAt: Date.now() };
  });
}

async function fetchOpenMeteoCurrent(lat, lon) {
  return sessionCachedJson(weatherCacheKey(lat, lon), WEATHER_TTL_MS, async () => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude",  String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current",   "temperature_2m,cloud_cover,wind_speed_10m");
    url.searchParams.set("timezone",  "auto");
    const res     = await fetch(url, { cache: "default" });
    const data    = await res.json();
    const current = data.current || {};
    return {
      temp:   current.temperature_2m != null ? Math.round(current.temperature_2m)          : null,
      clouds: current.cloud_cover    != null ? Math.round(current.cloud_cover)              : null,
      wind:   current.wind_speed_10m != null ? Math.round(current.wind_speed_10m * 10) / 10 : null,
      fetchedAt: Date.now(),
    };
  });
}

function getField(field, lang) {
  if (!field) return "";
  if (typeof field === "object" && !Array.isArray(field)) {
    return field[lang] || field["fi-FI"] || field["en-US"] || Object.values(field)[0] || "";
  }
  return field;
}

export default function PlacesSection({ kp: kpProp = null }) {
  const [placeData,    setPlaceData]    = useState({});
  const [randomPlaces, setRandomPlaces] = useState([]);
  const [localKp,      setLocalKp]      = useState(kpProp);
  const [cmsPlaces,    setCmsPlaces]    = useState({}); // slug → { name, short }

  const navigate          = useNavigate();
  const { t, currentLanguage } = useTranslation();
  const lang = currentLanguage === "en" ? "en-US" : "fi-FI";

  // Satunnaiset 3 paikkaa
  useEffect(() => {
    setRandomPlaces([...places].sort(() => 0.5 - Math.random()).slice(0, 3));
  }, []);

  // Contentful — hae kaikkien paikkojen name + short
  useEffect(() => {
    client.withAllLocales
      .getEntries({ content_type: "place", limit: 50 })
      .then((res) => {
        const map = {};
        res.items.forEach((item) => {
          console.log("slug kenttä:", JSON.stringify(item.fields.slug));
          
          // slug ei ole lokalisoitu → voi tulla stringinä tai objektina
          const slugVal = typeof slug === "object"
            ? Object.values(slug)[0]
            : slug;
          if (slugVal) {
            map[slugVal] = {
              name:  getField(item.fields.name,  lang),
              short: getField(item.fields.short, lang),
            };
          }
        });
        setCmsPlaces(map);
      })
      .catch((err) => console.warn("[places] Contentful fetch failed", err));
  }, [currentLanguage, lang]);

  // Kp
  useEffect(() => {
    if (kpProp != null) { setLocalKp(kpProp); return; }
    let cancelled = false;
    fetchCurrentKp()
      .then((d) => { if (!cancelled) setLocalKp(d.kp); })
      .catch((e) => console.warn("[places] kp failed", e));
    return () => { cancelled = true; };
  }, [kpProp]);

  // Sää
  useEffect(() => {
    if (randomPlaces.length === 0) return;
    let cancelled = false;
    Promise.all(
      randomPlaces.map(async (place) => {
        try {
          const weather = await fetchOpenMeteoCurrent(place.lat, place.lon);
          return { id: place.id, kp: localKp ?? null, ...weather };
        } catch {
          return { id: place.id, kp: localKp ?? null, temp: null, clouds: null, wind: null };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const mapped = {};
      results.forEach((r) => { mapped[r.id] = r; });
      setPlaceData(mapped);
    });
    return () => { cancelled = true; };
  }, [randomPlaces, localKp]);

  return (
    <section className="container">
      <h2>{t("locations.title")}</h2>
      <p>{t("locations.sub")}</p>

      <div className="places-grid">
        {randomPlaces.map((place) => {
          const data = placeData[place.id];
          const cms  = cmsPlaces[place.slug];
          const displayName  = cms?.name  || place.name;
          const displayShort = cms?.short || "";

          return (
            <div
              key={place.id}
              className="place-row"
              style={{ cursor: "pointer" }}
            >
              <div
                className="place-name"
                onClick={() => navigate(`/places/${place.slug}`)}
              >
                {displayName}
              </div>

              {displayShort && (
                <div className="place-short">{displayShort}</div>
              )}

              <div className="data-group">
                <div className="data-item">
                  <span className="label">KP</span>
                  <span className={`value kp-val ${kpClass(data?.kp)}`}>
                    {data != null ? (data.kp ?? "--") : "--"}
                  </span>
                </div>
                <div className="data-item">
                  <span className="label">{t("weather.clouds")}</span>
                  <span className="value">
                    {data?.clouds != null ? `${data.clouds}%` : "--"}
                  </span>
                </div>
                <div className="data-item">
                  <span className="label">{t("weather.temp")}</span>
                  <span className="value">
                    {data?.temp != null ? `${data.temp}°` : "--"}
                  </span>
                </div>
              </div>

              <div className="place-actions">
                <button
                  className="place-btn place-btn--map"
                  onClick={() => navigate(`/map?lat=${place.lat}&lon=${place.lon}`)}
                >
                  🗺 {t("places.viewMap") || "View on map"}
                </button>
                {cms && (
                  <button
                    className="place-btn place-btn--info"
                    onClick={() => navigate(`/places/${place.slug}`)}
                  >
                    {t("places.readMore") || "Read more"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}