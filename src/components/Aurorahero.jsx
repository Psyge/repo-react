import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { calculateAurora } from "../utils/auroraEngine";
import staticPlaces from "../data/places";
import { client } from "../lib/contentfulClient";
import Heroglobe from "./Heroglobe";

/* ========================================================================
   AuroraHero — dashboard-tyylinen etusivun hero
   - Valokuvatausta + CSS-revontulet
   - Iso Kp + tilateksti (free näkee Kp:n, premium myös todennäköisyyden)
   - Mittarikortit (tuuli / Bz / pilvet) deltoineen — näkyvät kaikille
   - Kp-ennustegraafi 1 vrk / 3 vrk -valitsimella (3 vrk = premium)
   - Oikea palsta: havainnot (children) + paikat
======================================================================= */

/* HUOM: NOAA:n vanhat product-feedit (kp/plasma/mag) jäätyivät keväällä 2026.
 * Propagated-feed on elossa ja sisältää plasman + magneettikentän yhdessä.
 * Nykyinen Kp otetaan ennuste-propista (forecast.slots), ei enää NOAA:n
 * kuolleesta kp-tuotteesta. */
const NOAA_PROP_URL = "https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json";
const SOLAR_MAX_AGE_MS = 3 * 60 * 60 * 1000; // hylkää tätä vanhempi "reaaliaika"

const HERO_SOLAR_CACHE_KEY = "aurora_session_cache:hero:solar:v4";
const HERO_SOLAR_TTL_MS    = 30 * 60 * 1000;
const WEATHER_TTL_MS       = 60 * 60 * 1000;
const THREE_LOAD_TIMEOUT_MS = 4000;

/* Graafin mitat — pehmennykset reunoilla akseleita varten */
const WAVE_W = 760;
const WAVE_H = 150;
const WAVE_PAD = { l: 34, r: 12, t: 14, b: 22 };

/* Graafin aikaikkunan valinta (1 vrk free / 3 vrk premium) */
const RANGE_KEY = "hero_wave_range_v1";

/* ---- lokalisoidun Contentful-kentän purku ---- */
function getField(field, lang) {
  if (!field) return "";
  if (typeof field === "object" && !Array.isArray(field)) {
    return field[lang] || field["fi-FI"] || field["en-US"] || Object.values(field)[0] || "";
  }
  return field;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

/* ---- session cache ---- */
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
  } catch {}
}
async function sessionCachedJson(key, ttlMs, fetcher) {
  const cached = readSessionCache(key, ttlMs);
  if (cached) return cached;
  const data = await fetcher();
  writeSessionCache(key, data);
  return data;
}

async function fetchJsonSafe(url, label) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} ${res.status}`);
  if (!text.trim()) throw new Error(`${label}: empty`);
  return JSON.parse(text);
}
function lastValidRow(rows, colIndex) {
  if (!Array.isArray(rows)) return null;
  for (let i = rows.length - 1; i >= 1; i--) {
    const v = parseFloat(rows[i]?.[colIndex]);
    if (!Number.isNaN(v)) return rows[i];
  }
  return null;
}
function firstValidRow(rows, colIndex) {
  if (!Array.isArray(rows)) return null;
  for (let i = 1; i < rows.length; i++) {
    const v = parseFloat(rows[i]?.[colIndex]);
    if (!Number.isNaN(v)) return rows[i];
  }
  return null;
}

/* Tuuli + Bz propagated-feedistä. Delta = muutos feedin tunnin ikkunan yli
   ("vs. tunti sitten" -indikaattorit). */
async function fetchHeroSolarData() {
  const cached = readSessionCache(HERO_SOLAR_CACHE_KEY, HERO_SOLAR_TTL_MS);
  if (cached) return cached;

  const propData = await fetchJsonSafe(NOAA_PROP_URL, "NOAA propagated").catch(() => null);

  /* Sarakkeet: time_tag, speed, density, temperature, bx, by, bz, bt, ... */
  let wind = null, bz = null, windDelta = null, bzDelta = null;
  const last = lastValidRow(propData, 1);
  if (last) {
    const ts = Date.parse(last[0]);
    if (Number.isNaN(ts) || Date.now() - ts <= SOLAR_MAX_AGE_MS) {
      const w = parseFloat(last[1]);
      const b = parseFloat(last[6]);
      wind = Number.isNaN(w) ? null : w;
      bz = Number.isNaN(b) ? null : b;

      const first = firstValidRow(propData, 1);
      if (first && first !== last) {
        const w0 = parseFloat(first[1]);
        const b0 = parseFloat(first[6]);
        if (!Number.isNaN(w0) && wind != null) windDelta = Math.round(wind - w0);
        if (!Number.isNaN(b0) && bz != null) bzDelta = Math.round((bz - b0) * 10) / 10;
      }
    } else {
      console.warn("NOAA propagated data vanhentunut:", last[0]);
    }
  }

  const data = { wind, bz, windDelta, bzDelta, fetchedAt: Date.now() };
  writeSessionCache(HERO_SOLAR_CACHE_KEY, data);
  return data;
}

/* ---- paikkakohtainen pilvisyys (Open-Meteo, YKSI batch-kutsu) ---- */
function placesWeatherCacheKey(places) {
  return `aurora_session_cache:hero:weather-all:${places.length}:v1`;
}
async function fetchAllPlacesWeather(places) {
  if (!places.length) return {};
  return sessionCachedJson(placesWeatherCacheKey(places), WEATHER_TTL_MS, async () => {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude",  places.map((p) => p.lat).join(","));
    url.searchParams.set("longitude", places.map((p) => p.lon).join(","));
    url.searchParams.set("current",   "temperature_2m,cloud_cover");
    url.searchParams.set("timezone",  "auto");

    const res  = await fetch(url, { cache: "default" });
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [data];

    const map = {};
    places.forEach((p, i) => {
      const c = arr[i]?.current || {};
      map[p.id] = {
        temp:   c.temperature_2m != null ? Math.round(c.temperature_2m) : null,
        clouds: c.cloud_cover    != null ? Math.round(c.cloud_cover)     : null,
      };
    });
    return map;
  });
}

function shouldEnhanceWith3D() {
  if (typeof window === "undefined") return false;
  const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (rm && rm.matches) return false;
  const conn = navigator.connection || navigator.webkitConnection || {};
  if (conn.saveData) return false;
  if (conn.effectiveType && !/4g/i.test(conn.effectiveType)) return false;
  const cores = navigator.hardwareConcurrency;
  if (cores && cores < 4) return false;
  try {
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl2") || cv.getContext("webgl");
    if (!gl) return false;
  } catch { return false; }
  return true;
}

function nextAwakening(slots) {
  if (!Array.isArray(slots) || !slots.length) return null;
  const now = Date.now();
  const upcoming = slots
    .map((s) => ({ ...s, ms: Date.parse(s.tsUtc) }))
    .filter((s) => !Number.isNaN(s.ms) && s.ms > now)
    .sort((a, b) => a.ms - b.ms);

  const hit = upcoming.find((s) => (s.kp ?? 0) >= 4 || s.level === "high" || s.level === "veryhigh");
  if (!hit) return null;
  const hours = Math.max(1, Math.round((hit.ms - now) / 3_600_000));
  return { hours, kp: hit.kp };
}

/* NOAA:n G-myrskyluokitus Kp:stä (kansainvälinen asteikko, ei lokalisoida) */
function kpStormLabel(kp) {
  if (kp == null) return null;
  if (kp >= 9) return "G5 Geomagnetic Storm";
  if (kp >= 8) return "G4 Geomagnetic Storm";
  if (kp >= 7) return "G3 Geomagnetic Storm";
  if (kp >= 6) return "G2 Geomagnetic Storm";
  if (kp >= 5) return "G1 Geomagnetic Storm";
  return null;
}

/* Pehmennetty polku (cubic bezier) — polyline näyttää kulmikkaalta */
function smoothPath(pts) {
  if (!pts.length) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const dx = (x1 - x0) / 3;
    d += ` C ${(x0 + dx).toFixed(1)} ${y0.toFixed(1)}, ${(x1 - dx).toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

/* Rakentaa Kp-ennustegraafin datan valitulle aikaikkunalle. */
function buildWave(slots, locale, horizonHours) {
  if (!Array.isArray(slots) || slots.length < 2) return null;

  const now = Date.now();
  const cutoff = now + horizonHours * 60 * 60 * 1000;
  const pts = slots
    .map((s) => ({ ms: Date.parse(s.tsUtc), kp: s.kp ?? 0 }))
    .filter((s) => !Number.isNaN(s.ms) && s.ms >= now - 3 * 60 * 60 * 1000 && s.ms <= cutoff)
    .sort((a, b) => a.ms - b.ms);
  if (pts.length < 2) return null;

  const t0 = pts[0].ms;
  const t1 = pts[pts.length - 1].ms;
  const span = Math.max(1, t1 - t0);
  const maxKp = 9;

  const innerW = WAVE_W - WAVE_PAD.l - WAVE_PAD.r;
  const innerH = WAVE_H - WAVE_PAD.t - WAVE_PAD.b;
  const x = (ms) => WAVE_PAD.l + ((ms - t0) / span) * innerW;
  const y = (kp) => WAVE_PAD.t + innerH - (Math.min(kp, maxKp) / maxKp) * innerH;
  const baseY = WAVE_PAD.t + innerH;

  const linePts = pts.map((p) => [x(p.ms), y(p.kp)]);

  const areaPath =
    `${smoothPath(linePts)} L ${linePts[linePts.length - 1][0].toFixed(1)} ${baseY} L ${linePts[0][0].toFixed(1)} ${baseY} Z`;

  const yTicks = [0, 3, 6, 9].map((kp) => ({ y: y(kp), kp }));

  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const dayTicks = [];
  const d0 = new Date(t0);
  d0.setHours(24, 0, 0, 0);
  for (let ms = d0.getTime(); ms < t1; ms += 24 * 60 * 60 * 1000) {
    dayTicks.push({ x: x(ms), label: dayFmt.format(ms) });
  }

  const peakSrc = pts.reduce((a, b) => (b.kp > a.kp ? b : a));
  const peak = { x: x(peakSrc.ms), y: y(peakSrc.kp), kp: peakSrc.kp };

  const nowX = now >= t0 && now <= t1 ? x(now) : null;

  return {
    openPath: smoothPath(linePts),
    areaPath,
    yTicks,
    dayTicks,
    peak,
    baseY,
    nowX,
  };
}

/* Mittarikortti (tuuli/Bz/pilvet) delta-indikaattorilla */
function MetricCard({ label, value, unit, delta, deltaUnit, deltaSuffix }) {
  const dir = delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <div className="ah-metric">
      <span className="ah-metric-label">{label}</span>
      <span className="ah-metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {delta != null && (
        <span className={`ah-metric-delta ah-metric-delta--${dir}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {delta > 0 ? "+" : ""}{delta}{deltaUnit} {deltaSuffix}
        </span>
      )}
    </div>
  );
}

/* ======================================================================== */
export default function AuroraHero({ forecast, children }) {
  const navigate = useNavigate();
  const { currentLanguage, t } = useTranslation();

  const slots = useMemo(() => forecast?.slots ?? [], [forecast]);
  const tier  = forecast?.tier ?? "free";
  const isPremium = tier === "premium";

  const [kp, setKp]     = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz]     = useState(null);
  const [windDelta, setWindDelta] = useState(null);
  const [bzDelta, setBzDelta]     = useState(null);
  const [threeReady, setThreeReady] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const [contentfulPlaces, setContentfulPlaces] = useState([]);
  const [placeWeather, setPlaceWeather] = useState({}); // { [id]: { clouds, temp } }

  /* Aikaikkuna: 1 vrk (free & premium) / 3 vrk (vain premium). */
  const [range, setRange] = useState(() => {
    try {
      const v = localStorage.getItem(RANGE_KEY);
      return v === "1d" || v === "3d" ? v : "3d";
    } catch { return "3d"; }
  });
  const effectiveRange = isPremium ? range : "1d";
  const horizonHours = effectiveRange === "1d" ? 24 : 72;

  const selectRange = (key) => {
    if (key === "3d" && !isPremium) {
      navigate("/premium");
      return;
    }
    setRange(key);
    try { localStorage.setItem(RANGE_KEY, key); } catch {}
  };

  const lang = currentLanguage === "en" ? "en-US" : "fi-FI";
  const locale = currentLanguage === "en" ? "en-GB" : "fi-FI";

  /* Käännös fallbackilla — jos avainta ei ole, käytä annettua tekstiä */
  const trh = (key, fi, en) => {
    const s = t(key);
    if (s != null && s !== key) return s;
    return currentLanguage === "en" ? en : fi;
  };

  /* Contentful-paikat (Content Type: place) */
  useEffect(() => {
    client.withAllLocales
      .getEntries({ content_type: "place", limit: 100 })
      .then((response) => setContentfulPlaces(response.items || []))
      .catch((err) => console.error("Contentful places error:", err));
  }, []);

  /* Paikkakohtainen pilvisyys Open-Meteosta — yksi batch-kutsu (kerran mountissa) */
  useEffect(() => {
    let cancelled = false;
    fetchAllPlacesWeather(staticPlaces)
      .then((map) => { if (!cancelled) setPlaceWeather(map); })
      .catch((e) => console.warn("Open-Meteo batch failed:", e));
    return () => { cancelled = true; };
  }, []);

  /* Yhdistetään: staattiset paikat + globaali Kp/tuuli + paikan pilvisyys + Contentful-teksti */
  const placesList = useMemo(() => {
    return staticPlaces.map((sp) => {
      const w = placeWeather[sp.id];
      const localKp     = kp ?? null;
      const localWind   = wind ?? 400;
      const localClouds = w?.clouds ?? null;

      const cfMatch = contentfulPlaces.find((item) => {
        const slugField = item?.fields?.slug;
        const vals = (slugField && typeof slugField === "object")
          ? Object.values(slugField)
          : [slugField];
        return vals.some(
          (v) => v != null && String(v).toLowerCase() === String(sp.slug).toLowerCase()
        );
      });

      const localAurora = calculateAurora({
        kp: localKp ?? 0,
        speed: localWind,
        density: 5,
        bz: bz ?? 0,
        cloudCover: localClouds ?? 50,
        latitude: sp.lat,
      });

      const rawDescription =
        cfMatch?.fields?.short ||
        cfMatch?.fields?.description ||
        cfMatch?.fields?.desc;
      const description = getField(rawDescription, lang);

      const rawName = cfMatch?.fields?.name || cfMatch?.fields?.title;
      const displayName = getField(rawName, lang) || sp.name;

      return {
        ...sp,
        name: displayName,
        description,
        prob: localAurora?.probability ?? 0,
        currentKp: localKp,
        currentClouds: localClouds,
        currentTemp: w?.temp ?? null,
      };
    });
  }, [contentfulPlaces, placeWeather, kp, wind, bz, lang]);

  const [activePlace, setActivePlace] = useState(null);

  useEffect(() => {
    if (placesList.length > 0) {
      setActivePlace((prev) => {
        if (prev) {
          const updated = placesList.find((p) => p.id === prev.id);
          if (updated) return updated;
        }
        return placesList[0];
      });
    }
  }, [placesList]);

  const canvasRef = useRef(null);
  const skyRef    = useRef(null);
  const probRef   = useRef(null);

  /* Solar data fetch (tuuli + Bz + deltat propagated-feedistä) */
  useEffect(() => {
    let cancelled = false;
    fetchHeroSolarData()
      .then((d) => {
        if (cancelled) return;
        setWind(d.wind); setBz(d.bz);
        setWindDelta(d.windDelta ?? null);
        setBzDelta(d.bzDelta ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* Nykyinen Kp ennustesarjasta (lähin slotti nykyhetkeen) — NOAA:n vanha
     kp-tuote jäätyi keväällä 2026 eikä päivity enää. */
  useEffect(() => {
    if (!slots.length) return;
    const now = Date.now();
    let best = null, bestD = Infinity;
    for (const s of slots) {
      const ms = Date.parse(s.tsUtc);
      if (Number.isNaN(ms)) continue;
      const d = Math.abs(ms - now);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best?.kp != null) setKp(best.kp);
  }, [slots]);

  const aurora = useMemo(
    () => calculateAurora({ kp, speed: wind, density: 5, bz, cloudCover: 50, latitude: activePlace?.lat || 66.5 }),
    [kp, wind, bz, activePlace]
  );
  const probability = aurora?.probability ?? null;
  probRef.current = probability;

  const awakening = useMemo(() => nextAwakening(slots), [slots]);
  const wave = useMemo(
    () => buildWave(slots, locale, horizonHours),
    [slots, locale, horizonHours]
  );

  const kpStep = useMemo(() => {
    if (kp == null || kp < 1.5) return 0;
    if (kp < 3.5) return 1;
    if (kp < 5.5) return 2;
    return 3;
  }, [kp]);

  const targetIntensity = useMemo(() => {
    if (kpStep === 0) return 0.0;
    if (kpStep === 1) return 0.25;
    if (kpStep === 2) return 0.60;
    return 1.0;
  }, [kpStep]);

  /* GPS → lähin piste aktiiviseksi */
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation && placesList.length > 0) {
      navigator.geolocation.getCurrentPosition((position) => {
        const uLat = position.coords.latitude;
        const uLon = position.coords.longitude;
        let closest = placesList[0];
        let minDst = getDistance(uLat, uLon, placesList[0].lat, placesList[0].lon);
        placesList.forEach((p) => {
          const dst = getDistance(uLat, uLon, p.lat, p.lon);
          if (dst < minDst) { minDst = dst; closest = p; }
        });
        setActivePlace(closest);
      });
    }
  }, [placesList]);

  /* Three.js taivas */
  useEffect(() => {
    if (!shouldEnhanceWith3D()) return;
    let cancelled = false;
    let tooLate = false;
    const timer = setTimeout(() => { tooLate = true; }, THREE_LOAD_TIMEOUT_MS);

    import("../utils/auroraSky")
      .then(({ createAuroraSky }) => {
        if (cancelled || tooLate || !canvasRef.current) return;
        skyRef.current = createAuroraSky(canvasRef.current, { intensity: targetIntensity });
        setThreeReady(true);
      })
      .catch((e) => console.warn(e));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (skyRef.current) { skyRef.current.destroy(); skyRef.current = null; }
    };
  }, [targetIntensity]);

  useEffect(() => {
    if (skyRef.current) skyRef.current.setIntensity(targetIntensity);
  }, [targetIntensity]);

  const calm = kpStep <= 1;
  const isActive = kpStep >= 2;

  const headline = calm ? t("aurora.calm") : t("aurora.active");
  const nextLine = isPremium && awakening
    ? String(t("aurora.next")).replace("{h}", awakening.hours)
    : (!calm ? "" : t("aurora.quiet"));

  /* Iso tilateksti Kp:n mukaan */
  const statusWord =
    kp == null ? "–"
    : kp >= 5   ? trh("hero.status.high", "Korkea aktiivisuus", "High Activity")
    : kp >= 3.5 ? trh("hero.status.elevated", "Kohonnut aktiivisuus", "Elevated Activity")
    : kp >= 1.5 ? trh("hero.status.moderate", "Kohtalainen aktiivisuus", "Moderate Activity")
    :             trh("hero.status.quiet", "Rauhallinen", "Quiet");

  const storm = kpStormLabel(kp);
  const vsLastHour = trh("hero.vsLastHour", "vs. tunti sitten", "vs last hour");

  return (
    <section className={`aurora-hero-container ah-hero--dash ${threeReady ? "three-active" : ""} ${isActive ? "is-active" : ""} kp-step-${kpStep}`}>

      <div className="ah-sky-wrap">
        {kpStep > 0 && <div className="ah-sky--css" aria-hidden="true" />}
        <canvas ref={canvasRef} className="ah-canvas" aria-hidden="true" />
      </div>

      {/* CSS-revontuliverhot + tähdet (aina näkyvissä, hienovaraiset) */}
      <div className="ah-ambient" aria-hidden="true" />

      <div className="ah-dash">

        {/* Ylärivi: iso Kp + tila vasemmalla, globe oikealla */}
        <div className="ah-dash-top">
          <div className="ah-dash-headline">
            <div className="ah-eyebrow">
              <span className="ah-eyebrow-dot" />
              {trh("hero.eyebrow", "AURORA-AKTIIVISUUS · GEOMAGNEETTINEN INDEKSI", "AURORA ACTIVITY · GEOMAGNETIC INDEX")}
            </div>

            <div className="ah-kp-row">
              <span className="ah-kp-big">{kp != null ? kp.toFixed(1) : "–"}</span>
              <div className="ah-kp-meta">
                <span className="ah-kp-label">KP INDEX</span>
                <span className="ah-kp-status">{statusWord}</span>
                {storm && <span className="ah-kp-storm">{storm}</span>}
              </div>
            </div>

            <h1 className="ah-dash-desc">
              {headline} {nextLine}
            </h1>

            <div className="ah-probability-box">
              <span className="ah-prob-label">{t("probability.label")}:</span>
              {isPremium ? (
                <strong className="ah-premium-prob-value">
                  {probability != null ? `${probability}%` : "--"}
                </strong>
              ) : (
                <div className="ah-premium-cta-container">
                  <button className="ah-premium-link-btn" onClick={() => navigate('/premium')}>
                    🔒 {t("forecast.unlock48")}
                  </button>
                  <span className="ah-premium-subtext">
                    {t("premium.teaser.short")}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Heroglobe />
        </div>

        {/* Alarivi: vasen palsta (mittarit + graafi), oikea palsta (havainnot + paikat) */}
        <div className="ah-dash-grid">
          

            {/* Mittarikortit — samat arvot kaikille (julkista dataa) */}
            <div className="ah-metrics">
              <MetricCard
                label={trh("hero.metric.wind", "Aurinkotuuli", "Solar Wind Speed")}
                value={wind != null ? Math.round(wind) : "–"}
                unit="km/s"
                delta={windDelta}
                deltaUnit=""
                deltaSuffix={vsLastHour}
              />
              <MetricCard
                label={trh("hero.metric.bz", "Bz-komponentti", "Bz Component")}
                value={bz != null ? bz.toFixed(1) : "–"}
                unit="nT"
                delta={bzDelta}
                deltaUnit=""
                deltaSuffix={vsLastHour}
              />
              <MetricCard
                label={`${trh("hero.metric.clouds", "Pilvisyys", "Cloud Cover")}${activePlace ? ` · ${activePlace.name}` : ""}`}
                value={activePlace?.currentClouds != null ? activePlace.currentClouds : "–"}
                unit="%"
                delta={null}
              />
            </div>

            {/* Kp-ennustegraafi */}
            <div className="ah-wave">
              <div className="ah-wave-panel">
                <div className="ah-wave-head">
                  <span className="ah-wave-title">
                    {effectiveRange === "1d"
                      ? trh("forecast.waveTitle1d", "Kp-ennuste · seuraavat 24 h", "Kp forecast · next 24 h")
                      : trh("forecast.waveTitle3d", "Kp-ennuste · seuraavat 3 vrk", "Kp forecast · next 3 days")}
                  </span>

                  <div className="ah-range">
                    {[
                      ["1d", trh("forecast.range1d", "1 vrk", "1 day")],
                      ["3d", trh("forecast.range3d", "3 vrk", "3 days")],
                    ].map(([key, label]) => {
                      const active = effectiveRange === key;
                      const locked = key === "3d" && !isPremium;
                      return (
                        <button
                          key={key}
                          className={`ah-range-btn ${active ? "ah-range-btn--active" : ""}`}
                          onClick={() => selectRange(key)}
                          title={locked ? trh("forecast.rangeLocked", "Koko 3 vrk ennuste Premiumilla", "Full 3-day forecast with Premium") : undefined}
                        >
                          {locked ? "🔒 " : ""}{label}
                        </button>
                      );
                    })}
                    <span className="ah-wave-source">NOAA</span>
                  </div>
                </div>

                {wave ? (
                  <svg
                    className="ah-wave-svg"
                    viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
                    role="img"
                    aria-label={trh("forecast.waveAria", "Revontuliaktiivisuuden Kp-ennuste", "Aurora activity Kp forecast")}
                  >
                    <defs>
                      <linearGradient id="ah-wave-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"  stopColor="#00ffc6" />
                        <stop offset="60%" stopColor="#14e0ff" />
                        <stop offset="100%" stopColor="#7d5fff" />
                      </linearGradient>
                      <linearGradient id="ah-wave-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#00ffc6" stopOpacity="0.26" />
                        <stop offset="100%" stopColor="#00ffc6" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {wave.yTicks.map((tick) => (
                      <g key={tick.kp}>
                        <line
                          className="ah-wave-grid"
                          x1={WAVE_PAD.l} y1={tick.y}
                          x2={WAVE_W - WAVE_PAD.r} y2={tick.y}
                        />
                        <text className="ah-wave-ylabel" x={WAVE_PAD.l - 7} y={tick.y + 3}>
                          {tick.kp}
                        </text>
                      </g>
                    ))}

                    {wave.dayTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          className="ah-wave-day-line"
                          x1={tick.x} y1={WAVE_PAD.t} x2={tick.x} y2={wave.baseY}
                        />
                        <text className="ah-wave-xlabel" x={tick.x + 4} y={WAVE_H - 6}>
                          {tick.label}
                        </text>
                      </g>
                    ))}

                    {wave.areaPath && <path className="ah-wave-area" d={wave.areaPath} />}
                    <path className="ah-wave-line" d={wave.openPath} />

                    {wave.nowX != null && (
                      <>
                        <line
                          className="ah-wave-now"
                          x1={wave.nowX} y1={WAVE_PAD.t} x2={wave.nowX} y2={wave.baseY}
                        />
                        <text className="ah-wave-now-label" x={wave.nowX + 4} y={WAVE_PAD.t + 9}>
                          {trh("forecast.now", "nyt", "now")}
                        </text>
                      </>
                    )}

                    {wave.peak && (
                      <>
                        <circle className="ah-wave-peak-dot" cx={wave.peak.x} cy={wave.peak.y} r="4" />
                        <text
                          className="ah-wave-peak-label"
                          x={wave.peak.x > WAVE_W - 130 ? wave.peak.x - 8 : wave.peak.x + 8}
                          y={Math.max(wave.peak.y - 8, WAVE_PAD.t + 10)}
                          textAnchor={wave.peak.x > WAVE_W - 130 ? "end" : "start"}
                        >
                          {trh("forecast.peak", "huippu", "peak")} Kp {wave.peak.kp.toFixed(1)}
                        </text>
                      </>
                    )}
                  </svg>
                ) : (
                  <div className="ah-wave-empty">
                    {trh("forecast.loading", "Ladataan ennustetta…", "Loading forecast…")}
                  </div>
                )}
              </div>
            </div>
          

          <aside className="ah-dash-side-top">
            {children && (
              <div className="ah-extra-wrapper">
                {!isPremium && (
                  <div className="ah-spin-teaser">
                    🎰 {t("spin.teaser") ||
                      "Spotted the lights? Report a sighting and spin to win free Premium."}
                  </div>
                )}
                {children}
              </div>
            )}
          </aside>
            <div className="ah-place-list">
  {placesList.map((p) => {
    const isSelected = activePlace && p.id === activePlace.id;
    const prob = p.currentKp != null ? p.prob : null;
    const barColor =
      prob == null ? "#475569"
      : prob >= 70 ? "#00ffc6"
      : prob >= 40 ? "#fee440"
      : "#f87171";
    return (
      <div
        key={p.id}
        className={`ah-place-row ${isSelected ? "is-active-item" : ""}`}
        onClick={() => { setActivePlace(p); setIsPopupOpen(true); }}
      >
        <div className="ah-place-row-head">
          <span className="ah-place-row-name">
            <span
              className="ah-item-dot-indicator"
              style={isSelected ? { background: barColor, boxShadow: `0 0 8px ${barColor}` } : {}}
            />
            {p.name}
          </span>
          <span className="ah-place-row-prob" style={{ color: barColor }}>
            {prob != null ? `${prob}%` : "–"}
          </span>
        </div>
        <div className="ah-place-row-meta">
          <span>Kp {p.currentKp != null ? p.currentKp.toFixed(1) : "–"}</span>
          <span>☁ {p.currentClouds != null ? `${p.currentClouds}%` : "–"}</span>
        </div>
        <div className="ah-place-bar-track">
          <div
            className="ah-place-bar-fill"
            style={{
              width: prob != null ? `${prob}%` : "0%",
              background: `linear-gradient(to right, ${barColor}80, ${barColor})`,
            }}
          />
        </div>
      </div>
    );
  })}
</div>
          
        </div>
      </div>

      {/* POPUP-MODAALI */}
      {isPopupOpen && activePlace && (
        <div className="ah-popup-backdrop" onClick={() => setIsPopupOpen(false)}>
          <div className="ah-popup-card" onClick={(e) => e.stopPropagation()}>
            <div className="ah-popup-drag-handle" onClick={() => setIsPopupOpen(false)} />
            <h3>📍 {activePlace.name}</h3>

            <div className="ah-popup-metrics">
              <span>Kp {activePlace.currentKp != null ? activePlace.currentKp.toFixed(1) : "--"}</span>
              <span>☁ {activePlace.currentClouds != null ? `${activePlace.currentClouds}%` : "--"}</span>
              <span>{activePlace.prob}%</span>
            </div>

            {activePlace.description ? (
              <div className="ah-popup-content">
                <p>{activePlace.description}</p>
                <button
                  className="ah-popup-readmore-btn"
                  onClick={() => {
                    setIsPopupOpen(false);
                    navigate(`/places/${activePlace.slug}`);
                  }}
                >
                  ✨ {t("places.readMore")}
                </button>
              </div>
            ) : (
              <p className="ah-popup-empty">Ei kuvausta saatavilla valitulla kielellä.</p>
            )}

            <button
              className="ah-popup-map-btn"
              onClick={() => {
                setIsPopupOpen(false);
                navigate(`/map?lat=${activePlace.lat}&lon=${activePlace.lon}`);
              }}
            >
              {t("places.viewAuroraMap")} 🗺️
            </button>
          </div>
        </div>
      )}
    </section>
  );
}