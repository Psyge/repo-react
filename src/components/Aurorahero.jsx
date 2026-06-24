import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { calculateAurora } from "../utils/auroraEngine";
import staticPlaces from "../data/places"; // Polku korjattu data-kansioon

/* ========================================================================
   AuroraHero — TÄYDELLINEN VERSIO (Kaikki logiikat palautettu)
======================================================================= */

const NOAA_KP_URL     = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const NOAA_PLASMA_URL = "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";
const NOAA_MAG_URL    = "https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json";

const HERO_SOLAR_CACHE_KEY = "aurora_session_cache:hero:solar:v1";
const HERO_SOLAR_TTL_MS    = 30 * 60 * 1000;
const THREE_LOAD_TIMEOUT_MS = 4000;

const WAVE_W = 760;
const WAVE_H = 120;

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
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
  } catch {}
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

async function fetchHeroSolarData() {
  const cached = readSessionCache(HERO_SOLAR_CACHE_KEY, HERO_SOLAR_TTL_MS);
  if (cached) return cached;

  const [kpData, plasmaData, magData] = await Promise.all([
    fetchJsonSafe(NOAA_KP_URL, "NOAA Kp").catch(() => null),
    fetchJsonSafe(NOAA_PLASMA_URL, "NOAA plasma").catch(() => null),
    fetchJsonSafe(NOAA_MAG_URL, "NOAA mag").catch(() => null),
  ]);

  const kpLast     = lastValidRow(kpData, 1);
  const plasmaLast = lastValidRow(plasmaData, 2);
  const magLast    = lastValidRow(magData, 3);

  const parsedKp   = kpLast ? parseFloat(kpLast[1]) : null;
  const parsedWind = plasmaLast ? parseFloat(plasmaLast[2]) : null;
  const parsedBz   = magLast ? parseFloat(magLast[3]) : null;

  const data = {
    kp:   Number.isNaN(parsedKp)   ? null : parsedKp,
    wind: Number.isNaN(parsedWind) ? null : parsedWind,
    bz:   Number.isNaN(parsedBz)   ? null : parsedBz,
    fetchedAt: Date.now(),
  };
  writeSessionCache(HERO_SOLAR_CACHE_KEY, data);
  return data;
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

function buildWave(slots, tier) {
  if (!Array.isArray(slots) || slots.length < 2) return null;
  const pts = slots
    .map((s) => ({ ms: Date.parse(s.tsUtc), kp: s.kp ?? 0 }))
    .filter((s) => !Number.isNaN(s.ms))
    .sort((a, b) => a.ms - b.ms);
  if (pts.length < 2) return null;

  const t0 = pts[0].ms;
  const t1 = pts[pts.length - 1].ms;
  const span = Math.max(1, t1 - t0);
  const maxKp = 9;

  const x = (ms) => ((ms - t0) / span) * WAVE_W;
  const y = (kp) => WAVE_H - (Math.min(kp, maxKp) / maxKp) * (WAVE_H - 16) - 8;

  const lockFromMs = tier === "free" ? t0 + span * 0.66 : null;

  const openPts = [];
  const lockPts = [];
  pts.forEach((p) => {
    const pt = [x(p.ms), y(p.kp)];
    if (lockFromMs != null && p.ms >= lockFromMs) lockPts.push(pt);
    else openPts.push(pt);
  });
  if (lockPts.length) openPts.push(lockPts[0]);

  const toPath = (arr) =>
    arr.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");

  const now = Date.now();
  const nowX = now >= t0 && now <= t1 ? x(now) : null;

  return {
    openPath: toPath(openPts),
    lockPath: lockPts.length ? toPath(lockPts) : null,
    nowX,
    lockX: lockFromMs != null ? x(lockFromMs) : null,
  };
}

/* ======================================================================== */
export default function Aurorahero({ forecast, contentfulPlaces, children }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const slots = useMemo(() => forecast?.slots ?? [], [forecast]);
  const tier  = forecast?.tier ?? "free";
  const isPremium = tier === "premium";

  const [kp, setKp]     = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz]     = useState(null);
  const [threeReady, setThreeReady] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Käytetään datakansiosta tuotuja paikkoja ja liitetään niihin Contentful-kuvaukset dynaamisesti
  const placesList = useMemo(() => {
    return staticPlaces.map((sp) => {
      const cfMatch = Array.isArray(contentfulPlaces) 
        ? contentfulPlaces.find((cf) => cf.id === sp.id || cf.slug === sp.slug)
        : null;
      return {
        ...sp,
        description: cfMatch?.description || cfMatch?.desc || "",
      };
    });
  }, [contentfulPlaces]);

  const [activePlace, setActivePlace] = useState(placesList[0] || staticPlaces[0]);

  const canvasRef = useRef(null);
  const skyRef    = useRef(null);
  const probRef   = useRef(null);

  useEffect(() => {
    if (placesList.length > 0) setActivePlace(placesList[0]);
  }, [placesList]);

  /* Solar-datan haku */
  useEffect(() => {
    let cancelled = false;
    fetchHeroSolarData()
      .then((d) => {
        if (cancelled) return;
        setKp(d.kp); setWind(d.wind); setBz(d.bz);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* Auroradata */
  const aurora = useMemo(
    () => calculateAurora({ kp, speed: wind, density: 5, bz, cloudCover: 50, latitude: 67.5 }),
    [kp, wind, bz]
  );
  const probability = aurora?.probability ?? null;
  probRef.current = probability;

  const awakening = useMemo(() => nextAwakening(slots), [slots]);
  const wave = useMemo(() => buildWave(slots, tier), [slots, tier]);

  /* Kp-portaistus visualisoinnille (0–3) */
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

  /* Automaattinen GPS-haku lähimmälle paikalle */
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation && placesList.length > 0) {
      navigator.geolocation.getCurrentPosition((position) => {
        const uLat = position.coords.latitude;
        const uLon = position.coords.longitude;

        let closest = placesList[0];
        let minDst = getDistance(uLat, uLon, placesList[0].lat, placesList[0].lon);

        placesList.forEach((p) => {
          const dst = getDistance(uLat, uLon, p.lat, p.lon);
          if (dst < minDst) {
            minDst = dst;
            closest = p;
          }
        });
        setActivePlace(closest);
      });
    }
  }, [placesList]);

  /* Three.js tehosteet */
  useEffect(() => {
    if (!shouldEnhanceWith3D()) return;

    let cancelled = false;
    let tooLate = false;
    const timer = setTimeout(() => { tooLate = true; }, THREE_LOAD_TIMEOUT_MS);

    import("../utils/auroraSky")
      .then(({ createAuroraSky }) => {
        if (cancelled || tooLate || !canvasRef.current) return;
        skyRef.current = createAuroraSky(canvasRef.current, {
          intensity: targetIntensity,
        });
        setThreeReady(true);
      })
      .catch((e) => console.warn("[AuroraHero] Three.js lataus virhe:", e));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (skyRef.current) {
        skyRef.current.destroy();
        skyRef.current = null;
      }
    };
  }, [targetIntensity]);

  useEffect(() => {
    if (skyRef.current) {
      skyRef.current.setIntensity(targetIntensity);
    }
  }, [targetIntensity]);

  const calm = kpStep <= 1;
  const isActive = kpStep >= 2;

  const headline = calm ? t("aurora.calm") : t("aurora.active");
  const nextLine = isPremium && awakening
    ? String(t("aurora.next")).replace("{h}", awakening.hours)
    : (!calm ? "" : t("aurora.quiet"));

  return (
    <section className={`aurora-hero-container ${threeReady ? "three-active" : ""} ${isActive ? "is-active" : ""} kp-step-${kpStep} tier-${tier}`}>
      
      {/* TAIVAS ELEMENTTI */}
      <div className="ah-sky-wrap">
        {kpStep > 0 && <div className="ah-sky--css" aria-hidden="true" />}
        <canvas ref={canvasRef} className="ah-canvas" aria-hidden="true" />
      </div>

      <div className="ah-content-layout">
        {/* Vasen puoli: Otsikot ja tilat */}
        <div className="ah-text-side">
          <h1 className="ah-main-title">
            {headline} {nextLine}
          </h1>
          
          <div className="ah-probability-box">
            <span className="ah-prob-label">{t("probability.label")}:</span>
            {isPremium ? (
              <strong className="ah-premium-prob-value">{probability != null ? `${probability}%` : "--"}</strong>
            ) : (
              <button className="ah-premium-link-btn" onClick={() => navigate('/premium')}>
                🔒 {t("forecast.unlock48")}
              </button>
            )}
          </div>
        </div>

        {/* Oikea puoli: Sivuttain rullaava raide places.js-tiedostosta */}
        <div className="ah-carousel-side">
          <div className="ah-horizontal-scroll-track">
            {placesList.map((p) => {
              const isSelected = p.id === activePlace.id;
              return (
                <div
                  key={p.id}
                  className={`ah-carousel-item-box ${isSelected ? "is-active-item" : ""}`}
                  onClick={() => {
                    setActivePlace(p);
                    setIsPopupOpen(true);
                  }}
                >
                  <div className="ah-item-dot-indicator" />
                  <span className="ah-item-name-label">{p.name}</span>
                  {isSelected && kp != null && (
                    <span className="ah-place-kp-value">Kp {kp.toFixed(1)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TUNTURISILUETTI */}
      <div className="ah-mountain-silhouet" aria-hidden="true">
        <svg viewBox="0 0 1440 180" className="ah-mountain-svg">
          <path d="M0,140 L160,115 C320,90 640,60 960,100 C1280,140 1360,165 1440,170 L1440,180 L0,180 Z" />
        </svg>
      </div>

      {/* ENNUSTEAALTOVIIVA */}
      {wave && (
        <div className="ah-wave">
          <svg viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} role="img" aria-label="Kp forecast wave">
            <defs>
              <linearGradient id="ah-wave-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"  stopColor="#00ffc6" />
                <stop offset="60%" stopColor="#14e0ff" />
                <stop offset="100%" stopColor="#7d5fff" />
              </linearGradient>
            </defs>
            {wave.nowX != null && (
              <line className="ah-wave-now" x1={wave.nowX} y1="0" x2={wave.nowX} y2={WAVE_H} />
            )}
            <path className="ah-wave-line" d={wave.openPath} />
            
            {wave.lockPath && !isPremium && (
              <>
                <path className="ah-wave-line is-locked" d={wave.lockPath} />
                <text className="ah-wave-lock" x={(wave.lockX ?? WAVE_W) + 6} y="16">
                  🔒 {t("forecast.unlock48")}
                </text>
              </>
            )}
          </svg>
        </div>
      )}

      {/* POPUP-KORTTI DYNAAMISELLA CONTENTFUL-DATALLA */}
      {isPopupOpen && (
        <div className="ah-popup-backdrop" onClick={() => setIsPopupOpen(false)}>
          <div className="ah-popup-card" onClick={(e) => e.stopPropagation()}>
            <div className="ah-popup-drag-handle" onClick={() => setIsPopupOpen(false)} />
            <h3>📍 {activePlace.name}</h3>
            
            {activePlace.description ? (
              <div className="ah-popup-content">
                <p>{activePlace.description}</p>
                <span className="ah-popup-more-badge">✨ {t("places.readMore")}</span>
              </div>
            ) : (
              <p className="ah-popup-empty">Ei lisätietoja saatavilla kohteelle.</p>
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

      {children && <div className="ah-extra-wrapper">{children}</div>}
    </section>
  );
}