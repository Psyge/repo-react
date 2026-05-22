```jsx
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

  const scene = useMemo(() => {
    // 0 → talvi
    // 1 → kesä
    const season =
      Math.sin(
        (month / 11) * Math.PI
      );

    // päivän pituus
    const daylightHours =
      2 + season * 22;

    const sunrise =
      12 - daylightHours / 2;

    const sunset =
      12 + daylightHours / 2;

    const polarNight =
      season < 0.12;

    const midnightSun =
      season > 0.9;

    // onko päivä
    let isDay =
      polarNight
        ? false
        : hour >= sunrise &&
          hour <= sunset;

    if (midnightSun) {
      isDay = true;
    }

    // auringon sijainti päivän aikana
    const clamped =
      (hour - sunrise) /
      Math.max(
        sunset - sunrise,
        0.1
      );

    // kuinka korkealle aurinko nousee
    const arcHeight =
      40 + season * 180;

    // pehmeämpi liike
    const curve =
      Math.sin(clamped * Math.PI);

    // X
    let x = clamped * 100;

    // Y
    let y =
      82 -
      curve *
        (arcHeight / 5);

    // keskiyön aurinko
    if (midnightSun) {
      const loop =
        Math.sin(
          (hour / 24) *
            Math.PI *
            2
        );

      y =
        38 -
        loop * 6;
    }

    // piilota horisontin alle
    const visible =
      y < 82;

    // revontulet vain talvella
    const auroraVisible =
      !isDay &&
      season < 0.45;

    // taivaan sävy
    const skyHue =
      220 - season * 70;

    // päivän kirkkaus
    const daylightStrength =
      isDay
        ? Math.max(
            0.25,
            curve
          )
        : 0;

    return {
      x,
      y,
      visible,
      isDay,
      auroraVisible,
      skyHue,
      daylightHours:
        Math.round(
          daylightHours
        ),
      polarNight,
      midnightSun,
      daylightStrength
    };
  }, [month, hour]);

  return (
    <section className="midnight-scene">

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
          {scene.polarNight
            ? "🌑 Polar Night"
            : scene.midnightSun
            ? "☀️ Midnight Sun"
            : scene.isDay
            ? "☀️ Daylight"
            : "🌌 Night"}
        </div>

        <div>
          Daylight:
          <strong>
            {scene.daylightHours}h
          </strong>
        </div>
      </div>

      {/* SKY */}

      <div
        className={`sky ${
          scene.isDay
            ? "day"
            : "night"
        }`}
        style={{
          background: scene.isDay
            ? `
              linear-gradient(
                180deg,
                hsl(${scene.skyHue}, 70%, ${
                  22 +
                  scene.daylightStrength *
                    30
                }%),
                hsl(${scene.skyHue}, 65%, ${
                  10 +
                  scene.daylightStrength *
                    20
                }%)
              )
            `
            : `
              linear-gradient(
                180deg,
                #02040a 0%,
                #050814 40%,
                #0a1020 100%
              )
            `
        }}
      >

        {/* STARS */}

        {!scene.isDay && (
          <div className="stars" />
        )}

        {/* AURORA */}

        {scene.auroraVisible && (
          <div className="aurora" />
        )}

        {/* SUN PATH */}

        <div className="sun-arc" />

        {/* SUN */}

        <div
          className="sun"
          style={{
            left: `${scene.x}%`,
            top: `${scene.y}%`,
            opacity:
              scene.visible
                ? 1
                : 0
          }}
        />

        {/* HORIZON */}

        <div className="horizon" />
      </div>

      {/* CONTROLS */}

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
```
