import { useRef, useEffect } from "react";
import "../styles/midnightSunV2.css";

export default function MidnightSunV2() {
const canvasRef = useRef(null);

useEffect(() => {
const canvas = canvasRef.current;


if (!canvas) return;

const ctx = canvas.getContext("2d");

let animationFrame;

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

  ctx.clearRect(0, 0, w, h);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);

  sky.addColorStop(0, "#02040a");
  sky.addColorStop(0.5, "#081020");
  sky.addColorStop(1, "#101c2e");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars
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

  // Test sun
  const sunX =
    w * (0.5 + Math.sin(time * 0.00015) * 0.35);

  const sunY =
    h * (0.35 - Math.cos(time * 0.00015) * 0.2);

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
  ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(sunX, sunY, 16, 0, Math.PI * 2);

  ctx.fillStyle = "#ffe066";
  ctx.fill();

  // Horizon
  const horizonY = h * 0.72;

  const ground = ctx.createLinearGradient(
    0,
    horizonY,
    0,
    h
  );

  ground.addColorStop(0, "#285a22");
  ground.addColorStop(1, "#081008");

  ctx.fillStyle = ground;
  ctx.fillRect(
    0,
    horizonY,
    w,
    h - horizonY
  );

  animationFrame =
    requestAnimationFrame(render);
};

render(0);

return () => {
  cancelAnimationFrame(animationFrame);
  window.removeEventListener(
    "resize",
    resize
  );
};


}, []);

return (
  <section className="midnight-v2">
    <canvas
      ref={canvasRef}
      className="midnight-canvas"
    />
  </section>
);
}
