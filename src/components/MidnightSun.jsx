import { useMemo, useState } from "react";
import "../styles/midnightSun.css";

const MONTHS = [
  "Jan", "Feb", "Mar",
  "Apr", "May", "Jun",
  "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec"
];

export default function MidnightSun() {
  const [month, setMonth] = useState(0);

  const [hour, setHour] = useState(12);

  const [mode, setMode] =
    useState("map");

  const scene = useMemo(() => {
    const season =
      Math.sin(
        (month / 11) * Math.PI
      );

    // kuinka korkealle aurinko nousee
    const arcHeight =
      40 + season * 220;

    // päivän pituus vuodenajan mukaan
    const daylightHours =
      2 + season * 22;

    const sunrise =
      12 - daylightHours / 2;

    const sunset =
      12 + daylightHours / 2;

    const isDay =
      hour >= sunrise &&
      hour <= sunset;

    // päivän eteneminen
    const dayProgress =
      (hour - sunrise) /
      (sunset - sunrise);

    const clamped =
      Math.max(
        0,
        Math.min(1, dayProgress)
      );

    const x =
      clamped * 100;

    // aurinkokaari
    const y =
      78 -
      Math.sin(clamped * Math.PI) *
        (arcHeight / 4);

    return {
      x,
      y,
      season,
      isDay,
      sunrise,
      sunset,
    };
  }, [month, hour]);

  return (
    <section
      className={`midnight-scene ${
        scene.isDay
          ? "day"
          : "night"
      }`}
    >
      {/* TOP CONTROLS */}

      <div className="view-toggle">
        <button
          className={
            mode === "map"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode("map")
          }
        >
          Aurora Map
        </button>

        <button
          className={
            mode === "horizon"
              ? "active"
              : ""
          }
          onClick={() =>
            setMode("horizon")
          }
        >
          Midnight Sun
        </button>
      </div>

      {/* HUD */}

      <div className="hud">
        <div>
          Month:
          <strong>
            {MONTHS[month]}
          </strong>
        </div>

        <div>
          Time:
          <strong>
            {hour}:00
          </strong>
        </div>

        <div>
          {scene.isDay
            ? "☀️ Daylight"
            : "🌌 Night"}
        </div>
      </div>

      {/* SCENE */}

      <div className="scene-wrap">
        {/* MAP VIEW */}

        <div
          className={`map-view ${
            mode === "map"
              ? "visible"
              : ""
          }`}
        >
          <div className="fake-map">
            <div className="map-label">
              Aurora Map
            </div>
          </div>
        </div>

        {/* HORIZON VIEW */}

        <div
          className={`horizon-view ${
            mode === "horizon"
              ? "visible"
              : ""
          }`}
        >
          <div className="sky">
            {!scene.isDay && (
              <div className="aurora" />
            )}

            <div className="sun-arc" />

            <div
              className="sun"
              style={{
                left: `${scene.x}%`,
                top: `${scene.y}%`,
                opacity:
                  scene.isDay
                    ? 1
                    : 0,
              }}
            />

            <div className="horizon" />
          </div>
        </div>
      </div>

      {/* SLIDERS */}

      <div className="sliders">
        <div>
          <label>
            Month
          </label>

          <input
            type="range"
            min="0"
            max="11"
            value={month}
            onChange={(e) =>
              setMonth(
                Number(
                  e.target.value
                )
              )
            }
          />
        </div>

        <div>
          <label>
            Time
          </label>

          <input
            type="range"
            min="0"
            max="23"
            value={hour}
            onChange={(e) =>
              setHour(
                Number(
                  e.target.value
                )
              )
            }
          />
        </div>
      </div>
    </section>
  );
}