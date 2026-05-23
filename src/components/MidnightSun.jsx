import { useMemo, useState, useEffect } from "react";
import SunCalc from "suncalc";
import useTranslation from "../hooks/useTranslation";
import "../styles/midnightSun.css";

const LAT = 66.5;
const LON = 26;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function MidnightSun() {
  const [month, setMonth] = useState(new Date().getMonth());
const [hour, setHour] = useState(new Date().getHours());
  const [kp, setKp] = useState(null);
  const { t } = useTranslation();

  // ===== KP FETCH
  useEffect(() => {
    const fetchKp = async () => {
      try {
        const res = await fetch(
          "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
        );
        const data = await res.json();
        const last = data[data.length - 1];
        setKp(parseFloat(last[1]));
      } catch (e) {
        console.warn("Kp fetch failed", e);
      }
    };
    fetchKp();
    const interval = setInterval(fetchKp, 60000);
    return () => clearInterval(interval);
  }, []);

  // ===== SCENE CALC
  const scene = useMemo(() => {
    const date = new Date(2025, month, 15, hour, 0, 0);

    const pos = SunCalc.getPosition(date, LAT, LON);
    const altitudeDeg = pos.altitude * (180 / Math.PI);

    const times = SunCalc.getTimes(date, LAT, LON);
    const sunriseH = isNaN(times.sunrise)
      ? null
      : times.sunrise.getHours() + times.sunrise.getMinutes() / 60;
    const sunsetH = isNaN(times.sunset)
      ? null
      : times.sunset.getHours() + times.sunset.getMinutes() / 60;

    const isDay = altitudeDeg > 0;
    const isTwilight = altitudeDeg > -6 && altitudeDeg <= 0;
    const polarNight = sunriseH === null && !isDay;
    const midnightSun = sunsetH === null && isDay;

    const x = (hour / 24) * 100;
    const maxAlt = 47;
    const normalizedAlt = altitudeDeg / maxAlt;
    const y = 82 - normalizedAlt * 72;
    const visible = altitudeDeg > -5;

    // Revontulet: sesonki loka-huhtikuu + Kp >= 2 + pimeä taivas
    const auroraSeasonMonths = [10, 11, 0, 1, 2,];
    const auroraVisible =
      !isDay &&
      !isTwilight &&
      altitudeDeg < -6 &&
      auroraSeasonMonths.includes(month) &&
      kp !== null &&
      kp >= 2;

    const skyHue = isDay ? 210 - (altitudeDeg / maxAlt) * 30 : 220;
    const skyLightness = isDay ? 15 + (altitudeDeg / maxAlt) * 35 : 3;

    const daylightHours = sunriseH !== null && sunsetH !== null
      ? Math.max(0, sunsetH - sunriseH)
      : polarNight ? 0 : 24;

    return {
      x,
      y,
      visible,
      isDay,
      isTwilight,
      auroraVisible,
      skyHue,
      skyLightness,
      daylightHours: Math.round(daylightHours * 10) / 10,
      polarNight,
      midnightSun,
      altitudeDeg: Math.round(altitudeDeg * 10) / 10,
      sunriseH,
      sunsetH,
      horizonColor,
    };
  }, [month, hour, kp]);


  const formatH = (h) => {
    if (h === null) return "–";
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  
  // Lisää scene useMemo:on paluuarvoon:
const horizonColor = (() => {
  if (month === 11 || month === 0 || month === 1) {
    // Talvi: lumi, valkoinen/sinertävä
    return {
      top: "#c8d8e8",
      mid: "#a0b8cc",
      bot: "#6a8599",
    };
  } else if (month === 2 || month === 3) {
    // Kevät: lumi sulaa, ruskea/harmaa
    return {
      top: "#8a7a6a",
      mid: "#6a5a4a",
      bot: "#3a2a1a",
    };
  } else if (month === 4 || month === 5 || month === 6 || month === 7) {
    // Kesä: vihreä
    return {
      top: "#2d5a27",
      mid: "#1a3d16",
      bot: "#0a1f09",
    };
  } else if (month === 8 || month === 9) {
    // Syksy: oranssi/punaruskea
    return {
      top: "#8b4a1a",
      mid: "#5a2d0a",
      bot: "#2a1205",
    };
  } else {
    // Marraskuu: harmaa, pimeys laskee
    return {
      top: "#3a3a3a",
      mid: "#222222",
      bot: "#0f0f0f",
    };
  }
})();
  const skyBg = scene.isDay
    ? `linear-gradient(180deg,
        hsl(${scene.skyHue}, 70%, ${scene.skyLightness}%),
        hsl(${scene.skyHue}, 65%, ${scene.skyLightness * 0.6}%)
      )`
    : scene.isTwilight
    ? `linear-gradient(180deg, #1a0a2e 0%, #0d0618 50%, #050810 100%)`
    : `linear-gradient(180deg, #02040a 0%, #050814 40%, #0a1020 100%)`;

  const statusLabel = scene.polarNight
    ? `🌑 ${t("sun.polarNight") || "Polar Night"}`
    : scene.midnightSun
    ? `☀️ ${t("sun.midnightSun") || "Midnight Sun"}`
    : scene.isDay
    ? `☀️ ${t("sun.daylight") || "Daylight"}`
    : scene.isTwilight
    ? `🌆 ${t("sun.twilight") || "Twilight"}`
    : `🌌 ${t("sun.night") || "Night"}`;

  return (
    <section className="midnight-scene">

      {/* HUD */}
      <div className="hud">
        <div>
          {t("sun.month") || "Month"}:
          <strong> {MONTHS[month]}</strong>
        </div>
        <div>
          {t("sun.time") || "Time"}:
          <strong> {String(hour).padStart(2, "0")}:00</strong>
        </div>
        <div>{statusLabel}</div>
        <div>
          {t("sun.daylight") || "Daylight"}:
          <strong> {scene.daylightHours}h</strong>
        </div>
        <div>
          {t("sun.sunrise") || "Sunrise"}:
          <strong> {formatH(scene.sunriseH)}</strong>
        </div>
        <div>
          {t("sun.sunset") || "Sunset"}:
          <strong> {formatH(scene.sunsetH)}</strong>
        </div>
        <div>
          {t("sun.altitude") || "Sun altitude"}:
          <strong> {scene.altitudeDeg}°</strong>
        </div>
        {kp !== null && (
          <div>
            Kp: <strong style={{
              color: kp >= 5 ? "#00ffcc" : kp >= 3 ? "#a8ff78" : "#9ca3af"
            }}>
              {kp}
            </strong>
          </div>
        )}
      </div>

      {/* SKY */}
      <div className="sky" style={{ background: skyBg }}>

        {/* STARS */}
        {!scene.isDay && !scene.isTwilight && (
          <div className="stars" />
        )}

        {/* AURORA */}
        {scene.auroraVisible && (
          <div className="aurora" />
        )}

        {/* SUN */}
        <div
          className={`sun ${scene.isTwilight ? "sun--twilight" : ""}`}
          style={{
            left: `${scene.x}%`,
            top: `${scene.y}%`,
            opacity: scene.visible ? 1 : 0,
          }}
        />

        {/* HORIZON */}
        <div
  className="horizon"
  style={{
    background: `linear-gradient(
      180deg,
      ${scene.horizonColor.top} 0%,
      ${scene.horizonColor.mid} 35%,
      ${scene.horizonColor.bot} 100%
    )`,
    transition: "background 1.5s ease",
  }}
/>
      </div>

      {/* INFO */}
      <div className="sun-info">
        {scene.polarNight && (
          <p>{t("sun.polarNightInfo") || "During polar night the sun stays below the horizon. Perfect conditions for northern lights!"}</p>
        )}
        {scene.midnightSun && (
          <p>{t("sun.midnightSunInfo") || "During midnight sun the sun never sets — northern lights are invisible even if they occur."}</p>
        )}
        {scene.auroraVisible && (
          <p>{t("sun.auroraInfo") || "🌌 Dark skies — good conditions for aurora hunting!"}</p>
        )}
      </div>

      {/* CONTROLS */}
      <div className="sliders">
        <div>
          <label>
            {t("sun.month") || "Month"}: <strong>{MONTHS[month]}</strong>
          </label>
          <input
            type="range" min="0" max="11" value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </div>
        <div>
          <label>
            {t("sun.time") || "Time"}: <strong>{String(hour).padStart(2, "0")}:00</strong>
          </label>
          <input
            type="range" min="0" max="23" value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          />
        </div>
      </div>

    </section>
  );
}