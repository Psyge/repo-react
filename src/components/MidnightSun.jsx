import { useMemo, useState } from "react";
import "./style/midnightSun.css";

const MONTHS = [
  "Jan", "Feb", "Mar",
  "Apr", "May", "Jun",
  "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec"
];

export default function MidnightSun() {
  const [month, setMonth] = useState(0);
  const [hour, setHour] = useState(12);

  const scene = useMemo(() => {
    const season =
      Math.sin(
        (month / 11) * Math.PI
      );

    // kuinka korkealle aurinko nousee
    const arcHeight =
      40 + season * 220;

    // kuinka paljon rata on näkyvissä
    const seasonOffset =
      -120 + season * 180;

    // kellon aika → 0..1
    const progress =
      hour / 24;

    const angle =
      progress * Math.PI * 2;

    const x =
      progress * 100;

    const y =
      50 -
      Math.sin(angle) *
        arcHeight /
        10 -
      seasonOffset / 10;

    const isDay =
      y < 52;

    return {
      x,
      y,
      season,
      isDay,
      arcHeight
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

      <div className="sky">
        {!scene.isDay && (
          <div className="aurora" />
        )}

        <div
          className="sun"
          style={{
            left: `${scene.x}%`,
            top: `${scene.y}%`,
            opacity:
              scene.y > 58
                ? 0
                : 1,
          }}
        />
      </div>

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