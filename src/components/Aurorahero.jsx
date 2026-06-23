import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { calculateAurora } from "../utils/auroraEngine";


/* ========================================================================
   AuroraHero  —  yhdistetty hero + ilmoitus (vain etusivulla)

   - CSS-orbi näkyy AINA (ei riippuvuuksia, latautuu heti)
   - three.js-orbi ladataan LAZY vain jos laite/yhteys kestää
   - probability/level: calculateAurora (sama logiikka kuin vanhassa Herossa)
   - "next awakening" + kp-aalto: forecast.slots[] = { tsUtc, kp, level }

   Props:
     forecast = { slots: [], current, tier, genAt }   (HomePage-tilasta)
======================================================================== */

const NOAA_KP_URL     = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const NOAA_PLASMA_URL = "https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json";
const NOAA_MAG_URL    = "https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json";

const HERO_SOLAR_CACHE_KEY = "aurora_session_cache:hero:solar:v1"; // sama avain → jaettu cache
const HERO_SOLAR_TTL_MS    = 30 * 60 * 1000;

const THREE_LOAD_TIMEOUT_MS = 4000; // jos 3D ei ehdi tässä ajassa → pysytään CSS:ssä

/* Sijainnit (sama henki kuin mockupissa). Säädä vapaasti. */
const PLACES = [
  { name: "Kilpisjärvi", lat: 69.05, lon: 20.79 },
  { name: "Saariselkä",  lat: 68.42, lon: 27.41 },
  { name: "Levi",        lat: 67.80, lon: 24.80 },
];

/* ---------------- session cache (kevyt) ---------------- */
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
  } catch { /* storage estetty */ }
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

/* ---------------- adaptiivinen capability-tarkistus ---------------- */
function shouldEnhanceWith3D() {
  if (typeof window === "undefined") return false;

  // reduced motion → ei raskasta animaatiota
  const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (rm && rm.matches) return false;

  const conn = navigator.connection || navigator.webkitConnection || {};
  if (conn.saveData) return false;
  if (conn.effectiveType && !/4g/i.test(conn.effectiveType)) return false; // 2g/3g → skip

  const cores = navigator.hardwareConcurrency;
  if (cores && cores < 4) return false;

  const mem = navigator.deviceMemory; // ei kaikissa selaimissa
  if (mem != null && mem < 4) return false;

  // WebGL saatavilla?
  try {
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl2") || cv.getContext("webgl");
    if (!gl) return false;
  } catch {
    return false;
  }
  return true;
}

/* ---------------- forecast → "next awakening" ---------------- */
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

/* ---------------- forecast → SVG-aaltopolku ---------------- */
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

  // free-tason "lukko": näytetään viimeinen kolmannes katkoviivana
  const lockFromMs = tier === "free" ? t0 + span * 0.66 : null;

  const openPts = [];
  const lockPts = [];
  pts.forEach((p) => {
    const pt = [x(p.ms), y(p.kp)];
    if (lockFromMs != null && p.ms >= lockFromMs) lockPts.push(pt);
    else openPts.push(pt);
  });
  if (lockPts.length) openPts.push(lockPts[0]); // jatkuvuus

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
export default function AuroraHero({ forecast }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const slots = forecast?.slots ?? [];
  const tier  = forecast?.tier ?? "free";

  const [kp, setKp]     = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz]     = useState(null);
  const [threeReady, setThreeReady] = useState(false);

  const canvasRef = useRef(null);
  const orbRef    = useRef(null);

  /* solar → probability/level */
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

  const awakening = useMemo(() => nextAwakening(slots), [slots]);
  const wave = useMemo(() => buildWave(slots, tier), [slots, tier]);

  /* ---- LAZY three.js ---- */
  useEffect(() => {
    if (!shouldEnhanceWith3D()) return;

    let cancelled = false;
    let tooLate = false;
    const timer = setTimeout(() => { tooLate = true; }, THREE_LOAD_TIMEOUT_MS);

    import("../utils/Auroraorb")
      .then(({ createAuroraOrb }) => {
        if (cancelled || tooLate || !canvasRef.current) return;
        orbRef.current = createAuroraOrb(canvasRef.current, {
          intensity: (probability ?? 20) / 100,
        });
        setThreeReady(true);
      })
      .catch((e) => console.warn("[AuroraHero] three.js lataus epäonnistui:", e));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (orbRef.current) {
        orbRef.current.destroy();
        orbRef.current = null;
      }
    };
  }, []); // ladataan vain kerran

  /* päivitä orbin intensiteetti kun todennäköisyys muuttuu */
  useEffect(() => {
    if (orbRef.current && probability != null) {
      orbRef.current.setIntensity(probability / 100);
    }
  }, [probability]);

  /* ---- otsikkotekstit (i18n-fallbackilla) ---- */
  const calm = level == null || level === "low";
  const headline = calm
    ? (t("aurora.calm") || "The skies are calm.")
    : (t("aurora.active") || "The skies are awake.");
  const nextLine = awakening
    ? (t("aurora.next") || "Next awakening expected in {h} hours.").replace("{h}", awakening.hours)
    : (t("aurora.quiet") || "No strong activity expected soon.");

  return (
    <section className={`aurora-hero ${threeReady ? "three-active" : ""}`}>
      {/* badge */}
      <div className="ah-badges">
        {tier === "premium" && <span className="ah-badge">Premium</span>}
      </div>

      {/* ORBI: CSS-pohja + (mahdollinen) three.js-canvas */}
      <div className="ah-orb-wrap">
        <div className="ah-orb--css" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className={`ah-canvas ${threeReady ? "is-ready" : ""}`}
          aria-hidden="true"
        />
      </div>

      {/* TILATEKSTI */}
      <div className="ah-status">
        <h1>
          {headline} {nextLine}
        </h1>
        <div className="ah-prob">
          {(t("probability.label") || "Aurora Probability")}:{" "}
          <strong>{probability != null ? `${probability}%` : "--"}</strong>
        </div>
      </div>

      {/* SIJAINNIT */}
      <div className="ah-places">
        {PLACES.map((p, i) => (
          <div
            key={p.name}
            className={`ah-place ${i === 0 ? "is-active" : ""}`}
            onClick={() => navigate(`/map?lat=${p.lat}&lon=${p.lon}`)}
          >
            <span className="ah-pin">📍</span>
            <span className="ah-place-name">{p.name}</span>
            {i === 0 && kp != null && (
              <span className="ah-place-sub">Kp {kp}</span>
            )}
          </div>
        ))}
      </div>

      {/* KP-AALTOVIIVA (SVG) */}
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
                  🔒 {t("forecast.unlock48") || "Unlock 48h — Premium"}
                </text>
              </>
            )}
          </svg>
        </div>
      )}
    </section>
  );
}