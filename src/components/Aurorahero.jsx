import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { calculateAurora } from "../utils/auroraEngine";

/* ========================================================================
   AuroraHero  —  UUSI HORISONTATIVIERITYS & TAIVASNÄKYMÄ

   - CSS-taustavärit ja Tunturijono (SVG) latautuvat heti ilman lagia.
   - three.js-taivas (auroraSky) ladataan LAZY taustalle jos yhteys sallii.
   - GPS hakee automaattisesti lähimmän paikkakunnan ja aktivoi sen.
   - Paikan nimen klikkaus avaa tyylikkään alhaalta nousevan info-kortin.
======================================================================= */

const NOAA_KP_URL     = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const NOAA_PLASMA_URL = "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";
const NOAA_MAG_URL    = "https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json";

const HERO_SOLAR_CACHE_KEY = "aurora_session_cache:hero:solar:v1";
const HERO_SOLAR_TTL_MS    = 30 * 60 * 1000;
const THREE_LOAD_TIMEOUT_MS = 4000;

const PLACES = [
  { name: "Kilpisjärvi", lat: 69.05, lon: 20.79, desc: "Suomen revontulipääkaupunki. Korkea sijainti takaa loiston lähes joka selkeänä yönä." },
  { name: "Saariselkä",  lat: 68.42, lon: 27.41, desc: "Upeat tunturimaisemat. Kauniit revontulikaaret tanssivat usein suoraan Kaunispään huipun yllä." },
  { name: "Levi",        lat: 67.80, lon: 24.80, desc: "Helposti saavutettava bongauspaikka. Kittilän tunturijonot tarjoavat loistavat taustat valokuvaukseen." },
];

/* Haversine-kaava etäisyyden laskemiseen GPS:ää varten */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

/* ---------------- session cache ja fetchit ---------------- */
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
  } catch { /* Varalla */ }
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

const WAVE_W = 760;
const WAVE_H = 120;
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
export default function Aurorahero({ forecast, children }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const slots = useMemo(() => forecast?.slots ?? [], [forecast]);
  const tier  = forecast?.tier ?? "free";

  const [kp, setKp]     = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz]     = useState(null);
  const [threeReady, setThreeReady] = useState(false);
  
  /* UUDET TILAT: GPS-aktiivinen paikka ja Popup-ikkuna */
  const [activePlace, setActivePlace] = useState(PLACES[0]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const canvasRef = useRef(null);
  const skyRef    = useRef(null); // Viittaus uuteen taivaaseen orbin sijaan
  const probRef   = useRef(null);

  /* Auroradata */
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

  const aurora = useMemo(
    () => calculateAurora({ kp, speed: wind, density: 5, bz, cloudCover: 50, latitude: 67.5 }),
    [kp, wind, bz]
  );
  const probability = aurora?.probability ?? null;
  const level = aurora?.level ?? null;
  probRef.current = probability;

  const awakening = useMemo(() => nextAwakening(slots), [slots]);
  const wave = useMemo(() => buildWave(slots, tier), [slots, tier]);

  /* ---- GPS AUTOMAATTINEN SEURANTA ---- */
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const uLat = position.coords.latitude;
          const uLon = position.coords.longitude;

          let closest = PLACES[0];
          let minDst = getDistance(uLat, uLon, PLACES[0].lat, PLACES[0].lon);

          PLACES.forEach((p) => {
            const dst = getDistance(uLat, uLon, p.lat, p.lon);
            if (dst < minDst) {
              minDst = dst;
              closest = p;
            }
          });
          setActivePlace(closest); // Asettaa automaattisesti lähimmän tunturipaikan
        },
        () => { /* Estetty tai virhe -> pysytään oletuksessa (Kilpisjärvi) */ }
      );
    }
  }, []);

  /* ---- LAZY UUSI THREE.JS TAIVAS ---- */
  useEffect(() => {
    if (!shouldEnhanceWith3D()) return;

    let cancelled = false;
    let tooLate = false;
    const timer = setTimeout(() => { tooLate = true; }, THREE_LOAD_TIMEOUT_MS);

    // Kutsutaan uutta korjattua tiedostoa!
    import("../utils/auroraSky")
      .then(({ createAuroraSky }) => {
        if (cancelled || tooLate || !canvasRef.current) return;
        skyRef.current = createAuroraSky(canvasRef.current, {
          intensity: (probRef.current ?? 20) / 100,
        });
        setThreeReady(true);
      })
      .catch((e) => console.warn("[AuroraHero] Three.js taivaan lataus epäonnistui:", e));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (skyRef.current) {
        skyRef.current.destroy();
        skyRef.current = null;
      }
    };
  }, []);

  /* Päivitetään taivaan voimakkuus */
  useEffect(() => {
    if (skyRef.current && probability != null) {
      skyRef.current.setIntensity(probability / 100);
    }
  }, [probability]);

  const calm = level == null || level === "low";
  const isActive = level === "high" || level === "veryhigh";

  const headline = calm ? t("aurora.calm") : t("aurora.active");
  const nextLine = awakening
    ? String(t("aurora.next")).replace("{h}", awakening.hours)
    : t("aurora.quiet");

  const probLabel = t("probability.label");
  const unlockLabel = t("forecast.unlock48");

  return (
    <section className={`aurora-hero ${threeReady ? "three-active" : ""} ${isActive ? "is-active" : ""}`}>
      
      {/* Premium Badge */}
      <div className="ah-badges">
        {tier === "premium" && <span className="ah-badge">Premium</span>}
      </div>

      {/* HORISONTVASTINE: Laaja taivasalue korvaa pyöreän orbi-kääreen */}
      <div className="ah-sky-wrap">
        {/* CSS-taustapilvet heti lataukseen */}
        <div className={`ah-sky--css ${isActive ? "is-active" : ""}`} aria-hidden="true" />
        
        {/* Korjattu Three.js Canvas vaakatasoiselle revontuliverholle */}
        <canvas ref={canvasRef} className={`ah-canvas ${threeReady ? "is-ready" : ""}`} aria-hidden="true" />
      </div>

      {/* TILATEKSTI (Leijuu taivaalla) */}
      <div className="ah-status">
        <h1>
          {headline} {nextLine}
        </h1>
        <div className="ah-prob">
          {probLabel}: <strong>{probability != null ? `${probability}%` : "--"}</strong>
        </div>
      </div>

      {/* MAA-OSA: SVG Tunturiprofiili leikkaa taivaan ja luo horisontin */}
      <div className="ah-mountain-silhouet" aria-hidden="true">
        <svg viewBox="0 0 1440 180" className="w-full h-auto fill-[#02040a]">
          <path d="M0,140 L160,115 C320,90 640,60 960,100 C1280,140 1360,165 1440,170 L1440,180 L0,180 Z" />
        </svg>
      </div>

      {/* PAIKKAKUNNAT: Upotettu horisontaaliseksi tunturipalkiksi maahan */}
      <div className="ah-places-horizon">
        <div className="ah-places-carousel">
          {PLACES.map((p) => {
            const isSelected = p.name === activePlace.name;
            return (
              <div
                key={p.name}
                className={`ah-place-node ${isSelected ? "is-active" : ""}`}
                onClick={() => {
                  setActivePlace(p);
                  setIsPopupOpen(true); // Klikkaus avaa infopopupin
                }}
              >
                <div className="ah-node-dot" />
                <span className="ah-place-name">{p.name}</span>
                {isSelected && kp != null && <span className="ah-node-kp">Kp {kp}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* KP-AALTOVIIVA (Säilytetty ennusteaaltona tunturipalkin alapuolella) */}
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
            {wave.lockPath && (
              <>
                <path className="ah-wave-line is-locked" d={wave.lockPath} />
                <text className="ah-wave-lock" x={(wave.lockX ?? WAVE_W) + 6} y="16">
                  🔒 {unlockLabel}
                </text>
              </>
            )}
          </svg>
        </div>
      )}

      {/* PIKKU-ESITTELY POPUP (BottomSheet-tyylinen modal alalaidassa) */}
      {isPopupOpen && (
        <div className="ah-popup-backdrop" onClick={() => setIsPopupOpen(false)}>
          <div className="ah-popup-card" onClick={(e) => e.stopPropagation()}>
            <div className="ah-popup-drag-handle" onClick={() => setIsPopupOpen(false)} />
            <h3>📍 {activePlace.name}</h3>
            <p>{activePlace.desc}</p>
            <button
              className="ah-popup-map-btn"
              onClick={() => {
                setIsPopupOpen(false);
                navigate(`/map?lat=${activePlace.lat}&lon=${activePlace.lon}`);
              }}
            >
              Avaa Live-Kartta 🗺️
            </button>
          </div>
        </div>
      )}

      {children && <div className="ah-extra">{children}</div>}
    </section>
  );
}