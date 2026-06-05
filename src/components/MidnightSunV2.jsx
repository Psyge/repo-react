import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

import "../styles/midnightSunV2.css";

import { drawSky } from "../utils/skyRenderer";
import { drawGround } from "../utils/groundRenderer";
import { drawAurora } from "../utils/auroraRenderer";
import { drawClouds } from "../utils/cloudRenderer";

import { fetchKp } from "../services/auroraService";
import { fetchCloudCover } from "../services/weatherService";

const LAT = 66.5;
const LON = 26;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

export default function MidnightSunV2() {
  const canvasRef = useRef(null);

  const [month, setMonth] = useState(
    new Date().getMonth()
  );

  const [hour, setHour] = useState(
    new Date().getHours()
  );

  const [kp, setKp] = useState(null);

  const [cloudCover, setCloudCover] =
    useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [kpData, cloudData] =
          await Promise.all([
            fetchKp(),
            fetchCloudCover(
              LAT,
              LON
            ),
          ]);

        setKp(kpData);
        setCloudCover(cloudData);
      } catch (err) {
        console.warn(err);
      }
    };

    loadData();

    const interval =
      setInterval(
        loadData,
        300000
      );

    return () =>
      clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    let animationFrame;

    const resize = () => {
      canvas.width =
        canvas.offsetWidth;

      canvas.height =
        canvas.offsetHeight;
    };

    resize();

    window.addEventListener(
      "resize",
      resize
    );

    const stars =
      Array.from(
        { length: 250 },
        () => ({
          x: Math.random(),
          y:
            Math.random() *
            0.7,
          size:
            Math.random() *
              2 +
            0.5,
          phase:
            Math.random() *
            Math.PI *
            2,
        })
      );

    const render = (time) => {
      const w =
        canvas.width;

      const h =
        canvas.height;

      ctx.clearRect(
        0,
        0,
        w,
        h
      );

      const date =
        new Date(
          2025,
          month,
          15,
          hour,
          0,
          0
        );

      const pos =
        SunCalc.getPosition(
          date,
          LAT,
          LON
        );

      const altitude =
        pos.altitude *
        (180 / Math.PI);

      const isDay =
        altitude > 0;

      const isTwilight =
        altitude <= 0 &&
        altitude > -6;

      drawSky(
        ctx,
        w,
        h,
        isDay,
        isTwilight
      );

      if (
        !isDay &&
        !isTwilight
      ) {
        stars.forEach(
          (star) => {
            const alpha =
              0.4 +
              Math.sin(
                time *
                  0.001 +
                  star.phase
              ) *
                0.3;

            ctx.beginPath();

            ctx.arc(
              star.x * w,
              star.y * h,
              star.size,
              0,
              Math.PI * 2
            );

            ctx.fillStyle =
              `rgba(
                255,
                255,
                255,
                ${alpha}
              )`;

            ctx.fill();
          }
        );
      }

      const auroraVisible =
        kp >= 2 &&
        !isDay &&
        !isTwilight &&
        altitude < -6;

      if (
        auroraVisible
      ) {
        drawAurora(
          ctx,
          w,
          h,
          kp,
          cloudCover,
          time
        );
      }

      drawClouds(
        ctx,
        w,
        h,
        cloudCover,
        time
      );

      const normalized =
        altitude / 47;

      const sunX =
        (hour / 23) * w;

      const sunY =
        h *
        (
          0.72 -
          normalized *
            0.55
        );

      if (
        altitude > -5
      ) {
        const glow =
          ctx.createRadialGradient(
            sunX,
            sunY,
            10,
            sunX,
            sunY,
            120
          );

        glow.addColorStop(
          0,
          "rgba(255,220,120,1)"
        );

        glow.addColorStop(
          1,
          "rgba(255,220,120,0)"
        );

        ctx.fillStyle =
          glow;

        ctx.beginPath();

        ctx.arc(
          sunX,
          sunY,
          120,
          0,
          Math.PI * 2
        );

        ctx.fill();

        ctx.beginPath();

        ctx.arc(
          sunX,
          sunY,
          16,
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          "#ffe066";

        ctx.fill();
      }

      drawGround(
        ctx,
        w,
        h,
        month
      );
    };

    const animate = (
      time
    ) => {
      render(time);

      animationFrame =
        requestAnimationFrame(
          animate
        );
    };

    animate(0);

    return () => {
      cancelAnimationFrame(
        animationFrame
      );

      window.removeEventListener(
        "resize",
        resize
      );
    };
  }, [
    month,
    hour,
    kp,
    cloudCover,
  ]);

  return (
    <section className="midnight-v2">

      <canvas
        ref={canvasRef}
        className="midnight-canvas"
      />

      <div className="hud">
        <div>
          Month:
          <strong>
            {" "}
            {
              MONTHS[
                month
              ]
            }
          </strong>
        </div>

        <div>
          Time:
          <strong>
            {" "}
            {String(
              hour
            ).padStart(
              2,
              "0"
            )}
            :00
          </strong>
        </div>

        <div>
          Kp:
          <strong>
            {" "}
            {kp ??
              "-"}
          </strong>
        </div>

        <div>
          Clouds:
          <strong>
            {" "}
            {
              cloudCover
            }
            %
          </strong>
        </div>
      </div>

      <div className="controls">

        <div>
          <label>
            Month{" "}
            {
              MONTHS[
                month
              ]
            }
          </label>

          <input
            type="range"
            min="0"
            max="11"
            value={month}
            onChange={(
              e
            ) =>
              setMonth(
                Number(
                  e.target
                    .value
                )
              )
            }
          />
        </div>

        <div>
          <label>
            Hour{" "}
            {hour}:00
          </label>

          <input
            type="range"
            min="0"
            max="23"
            value={hour}
            onChange={(
              e
            ) =>
              setHour(
                Number(
                  e.target
                    .value
                )
              )
            }
          />
        </div>

      </div>

    </section>
  );
}