import { useEffect, useRef, useState, useMemo } from "react";
import SunCalc from "suncalc";

import "../styles/midnightSunV2.css";

import { drawSky, drawSun, drawSunPath } from "../utils/skyRenderer";
import { drawGround }  from "../utils/groundRenderer";
import { drawAurora }  from "../utils/auroraRenderer";
import { drawClouds }  from "../utils/cloudRenderer";

import { fetchKp }         from "../services/auroraService";
import { fetchCloudCover } from "../services/weatherService";

const LAT = 66.5;
const LON = 26;

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

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

export default function MidnightSunV2() {
  const canvasRef = useRef(null);

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

  const stats = useMemo(() => getDayStats(2025, month, 15, LAT, LON), [month, LAT, LON]);
  const { isPolarNight, isMidnightSun, daylightH, riseH, setH } = stats;

  const hudDate = new Date(2025, month, 15, hour, 0, 0);
  const hudPos  = SunCalc.getPosition(hudDate, LAT, LON);
  const hudAlt  = hudPos.altitude * (180 / Math.PI);

  const isDay      = hudAlt > 0;
  const isTwilight = hudAlt > -6 && hudAlt <= 0;

  const statusLabel = isPolarNight  ? "🌑 Polar Night"
                    : isMidnightSun ? "☀️ Midnight Sun"
                    : isDay         ? "☀️ Day"
                    : isTwilight    ? "🌆 Twilight"
                    :                 "🌌 Night";

  const sunPathPoints = useMemo(() => {
    const pts = [];
    for (let h2 = 0; h2 < 24; h2 += 0.5) {
      const hFloor = Math.floor(h2);
      const mRound = Math.round((h2 % 1) * 60);
      const p = SunCalc.getPosition(new Date(2025, month, 15, hFloor, mRound, 0), LAT, LON);
      pts.push({
        alt: p.altitude * (180 / Math.PI),
        az:  ((p.azimuth + Math.PI) / (Math.PI * 2)) * 360,
      });
    }
    return pts;
  }, [month, LAT, LON]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [kpData, cloudData] = await Promise.all([
          fetchKp(),
          fetchCloudCover(LAT, LON),
        ]);
        setKp(kpData);
        setCloudCover(cloudData);
      } catch (err) {
        console.warn(err);
      }
    };
    loadData();
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationFrame;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 250 }, () => ({
      x:     Math.random(),
      y:     Math.random() * 0.68,
      size:  Math.random() * 1.8 + 0.4,
      phase: Math.random() * Math.PI * 2,
    }));

    const render = (time) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const date = new Date(2025, month, 15, hour, 0, 0);
      const pos  = SunCalc.getPosition(date, LAT, LON);
      const alt  = pos.altitude * (180 / Math.PI);
      const az   = ((pos.azimuth + Math.PI) / (Math.PI * 2)) * 360;

      const _isDay      = alt > 0;
      const _isTwilight = alt <= 0 && alt > -6;

      // 1. TAIVAS
      drawSky(ctx, w, h, _isDay, _isTwilight, month, alt);

      // 2. TÄHDET
      if (!_isDay && !_isTwilight) {
        stars.forEach((star) => {
          const a = 0.4 + Math.sin(time * 0.001 + star.phase) * 0.3;
          ctx.beginPath();
          ctx.arc(star.x * w, star.y * h, star.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fill();
        });
      }

      // 3. REVONTULET
      const auroraSeason  = [8, 9, 10, 11, 0, 1, 2, 3];
      const fakeAurora    = auroraSeason.includes(month) && !_isDay && !_isTwilight;
      const liveAurora    = showLiveWeather && kp >= 2 && alt < -6 && !_isDay && !_isTwilight;
      const auroraVisible = liveAurora || (!showLiveWeather && fakeAurora);

      if (auroraVisible) {
        drawAurora(ctx, w, h, liveAurora ? kp : 3, liveAurora ? cloudCover : 0, time);
      }

      // 4. PILVET
      if (showLiveWeather) {
        drawClouds(ctx, w, h, cloudCover, time);
      }

      // 5. AURINGON RATAKÄYRÄ
      if (alt > -10) {
        drawSunPath(ctx, w, h, sunPathPoints);
      }

      // 6. AURINKO
      drawSun(ctx, w, h, alt, az);

      // 7. MAA
      drawGround(ctx, w, h, month);
    };

    const animate = (time) => {
      render(time);
      animationFrame = requestAnimationFrame(animate);
    };
    animate(0);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, [month, hour, kp, cloudCover, showLiveWeather, sunPathPoints]);

  return (
    <section className="midnight-v2">
      <canvas ref={canvasRef} className="midnight-canvas" />

      <div className="msv2-status">{statusLabel}</div>

      <div className="msv2-hud">
        <span className="msv2-pill">
          Daylight: <strong>{daylightH.toFixed(1)}h</strong>
        </span>
        <span className="msv2-pill">
          Sun: <strong>{hudAlt.toFixed(1)}°</strong>
        </span>
        <span className="msv2-pill">
          Sunrise: <strong>{fmtH(riseH)}</strong>
        </span>
        <span className="msv2-pill">
          Sunset: <strong>{fmtH(setH)}</strong>
        </span>
        {kp !== null && (
          <span className="msv2-pill">
            Kp:{" "}
            <strong style={{ color: kp >= 5 ? "#5fffc8" : kp >= 3 ? "#a8ff78" : "#fff" }}>
              {showLiveWeather ? kp.toFixed(1) : "–"}
            </strong>
          </span>
        )}
        {showLiveWeather && (
          <span className="msv2-pill">
            Clouds: <strong>{cloudCover}%</strong>
          </span>
        )}
      </div>

      <div className="msv2-info">
        {isPolarNight && (
          <span className="msv2-info-tag">
            Polar night – sun stays below the horizon
          </span>
        )}
        {isMidnightSun && (
          <span className="msv2-info-tag">
            Midnight sun – sun never sets
          </span>
        )}
        {(showLiveWeather ? kp >= 2 : [8,9,10,11,0,1,2,3].includes(month)) &&
          !isDay && !isTwilight && (
          <span className="msv2-info-tag msv2-info-tag--aurora">
            🌌 Good aurora conditions
          </span>
        )}
      </div>

      <div className="msv2-controls">
        <div class="msv2-ctrl-row">
          <span className="msv2-ctrl-label">Month</span>
          <input
            type="range" min="0" max="11" value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
          <span className="msv2-ctrl-val">{MONTHS[month]}</span>
        </div>
        <div className="msv2-ctrl-row">
          <span className="msv2-ctrl-label">Time</span>
          <input
            type="range" min="0" max="23" value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          />
          <span className="msv2-ctrl-val">{String(hour).padStart(2, "0")}:00</span>
        </div>
      </div>
    </section>
  );
}