import { useRef, useEffect, useState } from "react";
import "../styles/midnightSunV2.css";

import SunCalc from "suncalc";

export default function MidnightSunV2() {
const canvasRef = useRef(null);
const [month, setMonth] = useState(new Date().getMonth());
const [hour, setHour] = useState(new Date().getHours());

const LAT = 66.5;
const LON = 26;

useEffect(() => {
const canvas = canvasRef.current;


if (!canvas) return;

const ctx = canvas.getContext("2d");



const resize = () => {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
};

resize();

window.addEventListener("resize", resize);

const stars = Array.from({ length: 250 }, () => ({
  x: Math.random(),
  y: Math.random() * 0.7,
  size: Math.random() * 2 + 0.5,
  phase: Math.random() * Math.PI * 2,
}));

const render = (time) => {
  const w = canvas.width;
  const h = canvas.height;
   const date = new Date(
  2025,
  month,
  15,
  hour,
  0,
  0
);

const pos = SunCalc.getPosition(
  date,
  LAT,
  LON
);

const altitude =
  pos.altitude * (180 / Math.PI);

const isDay = altitude > 0;

const isTwilight =
  altitude <= 0 &&
  altitude > -6;  

  ctx.clearRect(0, 0, w, h);

  // Sky
  const sky = ctx.createLinearGradient(
  0,
  0,
  0,
  h
);

if (isDay) {
  sky.addColorStop(0, "#5aa7ff");
  sky.addColorStop(1, "#d7ecff");
}
else if (isTwilight) {
  sky.addColorStop(0, "#20103a");
  sky.addColorStop(0.5, "#7a2f4f");
  sky.addColorStop(1, "#ff8a3d");
}
else {
  sky.addColorStop(0, "#02040a");
  sky.addColorStop(1, "#081020");
}

  

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars
  if (!isDay && !isTwilight) {
  stars.forEach((star) => {
    const alpha =
      0.4 +
      Math.sin(time * 0.001 + star.phase) * 0.3;

    ctx.beginPath();
    ctx.arc(
      star.x * w,
      star.y * h,
      star.size,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  });
  }

  // Test sun
 

const normalized =
  altitude / 47;

const sunX =
  (hour / 23) * w;

const sunY =
  h * (0.72 - normalized * 0.55);

if (altitude > -5) {

  const glow = ctx.createRadialGradient(
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

  ctx.fillStyle = glow;

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

  ctx.fillStyle = "#ffe066";
  ctx.fill();

}

render(0);

return () => {
  
  window.removeEventListener(
    "resize",
    resize
  );
};


}, [month, hour]);

return (
  <section className="midnight-v2">
    <canvas
      ref={canvasRef}
      className="midnight-canvas"
    />
    <div className="controls">
  <div>
    <label>Month {month + 1}</label>

    <input
      type="range"
      min="0"
      max="11"
      value={month}
      onChange={(e) =>
        setMonth(Number(e.target.value))
      }
    />
  </div>

  <div>
    <label>Hour {hour}:00</label>

    <input
      type="range"
      min="0"
      max="23"
      value={hour}
      onChange={(e) =>
        setHour(Number(e.target.value))
      }
    />
  </div>
</div>
  </section>
);
}
