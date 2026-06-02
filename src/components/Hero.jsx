import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { calculateAurora } from "../utils/auroraEngine";

const NOAA_KP_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

const NOAA_PLASMA_URL =
  "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";

const NOAA_MAG_URL =
  "https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json";

const HERO_SOLAR_CACHE_KEY = "aurora_session_cache:hero:solar:v1";
const HERO_SOLAR_TTL_MS = 30 * 60 * 1000; // 30 min

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
    sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      })
    );
  } catch {
    // Älä kaada sivua jos sessionStorage ei ole käytettävissä.
  }
}

async function fetchJsonSafe(url, label) {
  const res = await fetch(url, {
    cache: "no-store",
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
    if (!Number.isNaN(value)) return rows[i];
  }

  return null;
}

async function fetchHeroSolarData() {
  const cached = readSessionCache(HERO_SOLAR_CACHE_KEY, HERO_SOLAR_TTL_MS);
  if (cached) return cached;

  const [kpData, plasmaData, magData] = await Promise.all([
    fetchJsonSafe(NOAA_KP_URL, "NOAA Kp").catch((e) => {
      console.warn("NOAA Kp failed:", e);
      return null;
    }),
    fetchJsonSafe(NOAA_PLASMA_URL, "NOAA plasma").catch((e) => {
      console.warn("NOAA plasma failed:", e);
      return null;
    }),
    fetchJsonSafe(NOAA_MAG_URL, "NOAA mag").catch((e) => {
      console.warn("NOAA mag failed:", e);
      return null;
    }),
  ]);

  const kpLast = lastValidRow(kpData, 1);
  const plasmaLast = lastValidRow(plasmaData, 2);
  const magLast = lastValidRow(magData, 3);

  const parsedKp = kpLast ? parseFloat(kpLast[1]) : null;
  const parsedWind = plasmaLast ? parseFloat(plasmaLast[2]) : null;
  const parsedBz = magLast ? parseFloat(magLast[3]) : null;

  const data = {
    kp: Number.isNaN(parsedKp) ? null : parsedKp,
    wind: Number.isNaN(parsedWind) ? null : parsedWind,
    bz: Number.isNaN(parsedBz) ? null : parsedBz,
    fetchedAt: Date.now(),
  };

  writeSessionCache(HERO_SOLAR_CACHE_KEY, data);
  return data;
}

export default function Hero({ kp: kpProp = null, wind: windProp = null, bz: bzProp = null }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [kp, setKp] = useState(kpProp);
  const [wind, setWind] = useState(windProp);
  const [bz, setBz] = useState(bzProp);

  useEffect(() => {
    if (kpProp != null) setKp(kpProp);
    if (windProp != null) setWind(windProp);
    if (bzProp != null) setBz(bzProp);
  }, [kpProp, windProp, bzProp]);

  useEffect(() => {
    let cancelled = false;

    async function loadSolar() {
      try {
        // Jos parent antaa kaikki arvot, ei haeta uudestaan.
        if (kpProp != null && windProp != null && bzProp != null) return;

        const data = await fetchHeroSolarData();

        if (cancelled) return;

        setKp(data.kp);
        setWind(data.wind);
        setBz(data.bz);
      } catch (e) {
        console.warn("Hero solar fetch failed:", e);
      }
    }

    loadSolar();

    return () => {
      cancelled = true;
    };
  }, [kpProp, windProp, bzProp]);

  const aurora = useMemo(() => {
    return calculateAurora({
      kp,
      speed: wind,
      density: 5,
      bz,
      cloudCover: 50,
      latitude: 67.5,
    });
  }, [kp, wind, bz]);

  return (
    <div className="hero-split">
  <div className="hero-text">
    <h1>{t("app.tagline")}</h1>

    <p className="tagline">
      {t("hero.sub")}
    </p>
  </div>

      <div className="hero-grid">
        {/* KP / PROBABILITY BOX */}
        <div className="kp-display">
          <div className="kp-label">
            {t("probability.label")}
          </div>

          <div className="kp-big">
            <span>
              {aurora?.probability != null ? `${aurora.probability}%` : "--"}
            </span>
          </div>

          <div className="kp-level">
            {aurora?.level === "veryhigh" && (
              <span style={{ color: "#00ffcc" }}>
                🟢 {t("level.veryhigh") || "Excellent chance"}
              </span>
            )}

            {aurora?.level === "high" && (
              <span style={{ color: "#a8ff78" }}>
                🟡 {t("level.high") || "Good chance"}
              </span>
            )}

            {aurora?.level === "medium" && (
              <span style={{ color: "#ffd166" }}>
                🟠 {t("level.medium") || "Possible"}
              </span>
            )}

            {aurora?.level === "low" && (
              <span style={{ color: "#9aa3b2" }}>
                ⚫ {t("level.low") || "Unlikely tonight"}
              </span>
            )}

            {aurora?.level == null && (
              <span style={{ color: "#9aa3b2" }}>--</span>
            )}
          </div>

          <div className="kp-meta">
            <span>
              {t("kp.label")}: <strong>{kp ?? "--"}</strong>
            </span>

            <span>
              {t("wind.speed")}: <strong>{wind ?? "--"}</strong>
            </span>

            <span>
              {t("bz.label")}: <strong>{bz ?? "--"}</strong>
            </span>
          </div>
        </div>

        {/* MAP PREVIEW */}
        <div
          className="map-preview"
          onClick={() => navigate("/map")}
          style={{ cursor: "pointer" }}
        >
          <div className="map-preview-cta">
            {t("map.open")}
          </div>
        </div>
      </div>
    </section>
  );
}