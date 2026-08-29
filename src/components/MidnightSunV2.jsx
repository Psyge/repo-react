import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import SunCalc from "suncalc";
import usePolling from "../hooks/usePolling";

import useTranslation from "../hooks/useTranslation";
import "../styles/midnightSunV2.css";

import { drawSky, drawSun, drawSunPath } from "../utils/skyRenderer";
import { drawGround }  from "../utils/groundRenderer";
import { drawAurora }  from "../utils/auroraRenderer";
import { drawClouds }  from "../utils/cloudRenderer";

const BASE = process.env.REACT_APP_API_BASE || "";

const DEFAULT_LAT = 66.5;
const DEFAULT_LON = 26;

/* Kuukausiliukurin nimet tulevat Intl:stä, jotta ne kääntyvät kielen mukana */
function monthNames(lang) {
  try {
    const fmt = new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fi-FI", { month: "short" });
    return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(2025, m, 1)));
  } catch {
    return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  }
}

/* Nykytilanne omasta workerista.
   HUOM: aiemmin tässä käytettiin services/auroraService.js -tiedostoa, joka
   haki NOAA:n noaa-planetary-k-index.json -feedistä. Se feed jäätyi keväällä
   2026 eikä päivity enää, joten komponentti näytti kuukausia vanhaa Kp:tä
   live-lukuna. Worker hoitaa tuoreusvahdin ja antaa Suomessa FMI:n
   pilvidatan OpenWeatherin/Open-Meteon sijaan. */
async function fetchLiveConditions(lat, lon) {
  const res = await fetch(`${BASE}/api/aurora/calc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) throw new Error(`aurora/calc ${res.status}`);
  const d = await res.json();
  return {
    kp: typeof d.kp === "number" ? d.kp : null,
    clouds: typeof d.clouds === "number" ? d.clouds : 0,
  };
}

function getDayStats(year, month, day, lat, lon) {
  let maxAlt = -999, minAlt = 999;
  let riseH = null, setH = null, prevAlt = null;

  for (let h = 0; h <= 24; h++) {
    const pos = SunCalc.getPosition(new Date(year, month, day, h, 0, 0), lat, lon);
    const alt = pos.altitude * (180 / Math.PI);
    if (alt > maxAlt) maxAlt = alt;
    if (alt < minAlt) minAlt = alt;
    if (prevAlt !== null) {
      if (prevAlt < 0 && alt >= 0 && riseH === null)
        riseH = (h - 1) + (-prevAlt) / (alt - prevAlt);
      if (prevAlt >= 0 && alt < 0 && setH === null)
        setH  = (h - 1) + prevAlt / (prevAlt - alt);
    }
    prevAlt = alt;
  }

  const isPolarNight  = maxAlt < 0;
  const isMidnightSun = minAlt >= 0;
  const daylightH = riseH !== null && setH !== null
    ? Math.max(0, setH - riseH)
    : isMidnightSun ? 24 : 0;

  return { maxAlt, minAlt, riseH, setH, isPolarNight, isMidnightSun, daylightH };
}

function fmtH(h) {
  if (h === null || h === undefined) return "–";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function MidnightSunV2({ lat: propLat, lon: propLon }) {
  const lat = propLat ?? DEFAULT_LAT;
  const lon = propLon ?? DEFAULT_LON;

  const { currentLanguage, t } = useTranslation();
  const trh = (key, fi, en) => {
    const s = t(key);
    if (s != null && s !== key) return s;
    return currentLanguage === "en" ? en : fi;
  };

  const canvasRef = useRef(null);
  const starsRef = useRef(null);

  /* Kuluva vuosi, ei kovakoodattu — muuten kevätpäiväntasaus liukuu ajan myötä */
  const YEAR = useMemo(() => new Date().getFullYear(), []);
  const MONTHS = useMemo(() => monthNames(currentLanguage), [currentLanguage]);

  const [month, setMonth] = useState(new Date().getMonth());
  const [hour,  setHour]  = useState(new Date().getHours());
  const [kp,    setKp]    = useState(null);
  const [cloudCover, setCloudCover] = useState(0);

  const currentMonth = new Date().getMonth();
  const currentHour  = new Date().getHours();

  const hourDiff = Math.min(
    Math.abs(hour - currentHour),
    24 - Math.abs(hour - currentHour)
  );
  const showLiveWeather = month === currentMonth && hourDiff <= 3;

  const stats = useMemo(
    () => getDayStats(YEAR, month, 15, lat, lon),
    [YEAR, month, lat, lon]
  );
  const { isPolarNight, isMidnightSun, daylightH, riseH, setH } = stats;

  const hudDate = new Date(YEAR, month, 15, hour, 0, 0);
  const hudPos  = SunCalc.getPosition(hudDate, lat, lon);
  const hudAlt  = hudPos.altitude * (180 / Math.PI);

  const isDay      = hudAlt > 0;
  const isTwilight = hudAlt > -6 && hudAlt <= 0;

  const statusLabel = isPolarNight
    ? `🌑 ${trh("sun.polarNight", "Kaamos", "Polar night")}`
    : isMidnightSun
      ? `☀️ ${trh("sun.midnightSun", "Yötön yö", "Midnight sun")}`
      : isDay
        ? `☀️ ${trh("sun.day", "Päivä", "Day")}`
        : isTwilight
          ? `🌆 ${trh("sun.twilight", "Hämärä", "Twilight")}`
          : `🌌 ${trh("sun.night", "Yö", "Night")}`;

  const sunPathPoints = useMemo(() => {
    const pts = [];
    for (let h2 = 0; h2 < 24; h2 += 0.5) {
      const hFloor = Math.floor(h2);
      const mRound = Math.round((h2 % 1) * 60);
      const p = SunCalc.getPosition(
        new Date(YEAR, month, 15, hFloor, mRound, 0),
        lat,
        lon
      );
      pts.push({
        alt: p.altitude * (180 / Math.PI),
        az:  ((p.azimuth + Math.PI) / (Math.PI * 2)) * 360,
      });
    }
    return pts;
  }, [YEAR, month, lat, lon]);

  /* Päivitysväli 5 min → 30 min.
   *
   * Tämä hakee Kp:n ja pilvisyyden. Kp on kolmen tunnin indeksi ja
   * pilvisyys päivittyy lähteessä kerran tunnissa, joten viiden
   * minuutin haku kysyi samaa lukua kuusi kertaa turhaan.
   *
   * usePolling pysäyttää haun kun välilehti ei ole näkyvissä ja
   * hakee tuoreen heti kun käyttäjä palaa. */
  const loadConditions = useCallback(async () => {
    try {
      const { kp: k, clouds } = await fetchLiveConditions(lat, lon);
      setKp(k);
      setCloudCover(clouds);
    } catch (err) {
      console.warn("live conditions failed:", err?.message || err);
    }
  }, [lat, lon]);

  usePolling(loadConditions, 30 * 60 * 1000, [lat, lon]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    /* Debounce: mobiiliselain laukaisee resizen osoiterivin piiloutuessa */
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    };
    window.addEventListener("resize", onResize);

    /* Tähdet luodaan kerran ja säilyvät refissä — muuten ne hyppäisivät
       uusiin paikkoihin joka kerta kun Kp/pilvet päivittyvät (5 min välein) */
    if (!starsRef.current) {
      starsRef.current = Array.from({ length: 250 }, () => ({
        x:     Math.random(),
        y:     Math.random() * 0.68,
        size:  Math.random() * 1.8 + 0.4,
        phase: Math.random() * Math.PI * 2,
      }));
    }
    const stars = starsRef.current;

    const render = (time) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const date = new Date(YEAR, month, 15, hour, 0, 0);
      const pos  = SunCalc.getPosition(date, lat, lon);
      const alt  = pos.altitude * (180 / Math.PI);
      const az   = ((pos.azimuth + Math.PI) / (Math.PI * 2)) * 360;

      const _isDay      = alt > 0;
      const _isTwilight = alt <= 0 && alt > -6;

      drawSky(ctx, w, h, _isDay, _isTwilight, month, alt);

      if (!_isDay && !_isTwilight) {
        stars.forEach((star) => {
          const a = 0.4 + Math.sin(time * 0.001 + star.phase) * 0.3;
          ctx.beginPath();
          ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fill();
        });
      }

      const auroraSeason  = [8, 9, 10, 11, 0, 1, 2, 3];
      const fakeAurora    = auroraSeason.includes(month) && !_isDay && !_isTwilight;
      const liveAurora    = showLiveWeather && kp >= 2 && alt < -6 && !_isDay && !_isTwilight;
      const auroraVisible = liveAurora || (!showLiveWeather && fakeAurora);

      if (auroraVisible) {
        drawAurora(ctx, w, h, liveAurora ? kp : 3, liveAurora ? cloudCover : 0, time);
      }

      if (showLiveWeather) {
        drawClouds(ctx, w, h, cloudCover, time);
      }

      if (alt > -10) {
        drawSunPath(ctx, w, h, sunPathPoints);
      }

      drawSun(ctx, w, h, alt, az);
      drawGround(ctx, w, h, month);
    };

    /* Animaatio pysähtyy kun välilehti on piilossa — canvas-silmukka
       pyöri aiemmin taustalla ikuisesti ja söi akkua turhaan */
    let raf = null;
    const animate = (time) => {
      render(time);
      raf = requestAnimationFrame(animate);
    };
    const start = () => { if (raf == null) raf = requestAnimationFrame(animate); };
    const stop  = () => { if (raf != null) { cancelAnimationFrame(raf); raf = null; } };

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, [YEAR, month, hour, kp, cloudCover, showLiveWeather, sunPathPoints, lat, lon]);

  return (
    <section className="midnight-v2">
      <canvas ref={canvasRef} className="midnight-canvas" />

      <div className="msv2-status">{statusLabel}</div>

      <div className="msv2-hud">
        <span className="msv2-pill">
          {trh("sun.daylight", "Päivänvalo", "Daylight")}:{" "}
          <strong>{daylightH.toFixed(1)} h</strong>
        </span>
        <span className="msv2-pill">
          {trh("sun.altitude", "Auringon korkeus", "Sun altitude")}:{" "}
          <strong>{hudAlt.toFixed(1)}°</strong>
        </span>
        <span className="msv2-pill">
          {trh("sun.sunrise", "Auringonnousu", "Sunrise")}: <strong>{fmtH(riseH)}</strong>
        </span>
        <span className="msv2-pill">
          {trh("sun.sunset", "Auringonlasku", "Sunset")}: <strong>{fmtH(setH)}</strong>
        </span>
        {kp !== null && (
          <span className="msv2-pill">
            {trh("kp.label", "Kp", "Kp")}:{" "}
            <strong className={kp >= 5 ? "msv2-kp--high" : kp >= 3 ? "msv2-kp--mid" : ""}>
              {showLiveWeather ? kp.toFixed(1) : "–"}
            </strong>
          </span>
        )}
        {showLiveWeather && (
          <span className="msv2-pill">
            {trh("popup.clouds", "Pilvisyys", "Cloud cover")}: <strong>{cloudCover}%</strong>
          </span>
        )}
      </div>

      <div className="msv2-info">
        {isPolarNight && (
          <span className="msv2-info-tag">
            {trh(
              "sun.polarNightInfo",
              "Kaamos — aurinko ei nouse horisontin yläpuolelle.",
              "Polar night — the sun stays below the horizon."
            )}
          </span>
        )}
        {isMidnightSun && (
          <span className="msv2-info-tag">
            {trh(
              "sun.midnightSunInfo",
              "Yötön yö — aurinko ei laske.",
              "Midnight sun — the sun never sets."
            )}
          </span>
        )}
        {(showLiveWeather ? kp >= 2 : [8, 9, 10, 11, 0, 1, 2, 3].includes(month)) &&
          !isDay && !isTwilight && (
          <span className="msv2-info-tag msv2-info-tag--aurora">
            {trh(
              "sun.auroraInfo",
              "🌌 Pimeä taivas — hyvät olosuhteet revontulien katseluun!",
              "🌌 Dark skies — good conditions for northern lights!"
            )}
          </span>
        )}
      </div>

      <div className="msv2-controls">
        <div className="msv2-ctrl-row">
          <span className="msv2-ctrl-label">{trh("sun.month", "Kuukausi", "Month")}</span>
          <input
            type="range" min="0" max="11" value={month}
            aria-label={trh("sun.month", "Kuukausi", "Month")}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
          <span className="msv2-ctrl-val">{MONTHS[month]}</span>
        </div>
        <div className="msv2-ctrl-row">
          <span className="msv2-ctrl-label">{trh("sun.time", "Aika", "Time")}</span>
          <input
            type="range" min="0" max="23" value={hour}
            aria-label={trh("sun.time", "Aika", "Time")}
            onChange={(e) => setHour(Number(e.target.value))}
          />
          <span className="msv2-ctrl-val">{String(hour).padStart(2, "0")}:00</span>
        </div>
      </div>
    </section>
  );
}