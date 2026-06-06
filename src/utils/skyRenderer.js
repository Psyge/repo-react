/**
 * skyRenderer.js
 * Sama rajapinta: drawSky(ctx, w, h, isDay, isTwilight, month)
 * + drawSun(ctx, w, h, altitude, azimuth) — kutsutaan MidnightSunV2:sta
 */

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}


// Taivaan väripaletti auringon korkeuden mukaan (ei enää kuukausiportaat)
// alt: -18 … +60
function skyPalette(alt, month) {
  // Yö
  if (alt <= -12) return {
    top: [2, 4, 14],
    bot: [6, 10, 28],
  };

  // Syvä hämärä (-12 … -6)
  if (alt <= -6) {
    const t = (alt + 12) / 6;
    return {
      top: lerpColor([2, 4, 14],   [12, 18, 55],  t),
      bot: lerpColor([6, 10, 28],  [30, 22, 70],  t),
    };
  }

  // Hämärä / siviilihämärä (-6 … 0)
  if (alt <= 0) {
    const t = (alt + 6) / 6;
    // Kesä: vaalea yö, talvi: tummempi purppura
    const summerMix = month >= 4 && month <= 8;
    if (summerMix) {
      return {
        top: lerpColor([12, 18, 55],  [30, 55, 110],  t),
        bot: lerpColor([30, 22, 70],  [200, 120, 80], t),
      };
    }
    return {
      top: lerpColor([12, 18, 55],  [25, 30, 90],   t),
      bot: lerpColor([30, 22, 70],  [180, 80, 60],  t),
    };
  }

  // Kultainen tunti (0 … 6°)
  if (alt <= 6) {
    const t = alt / 6;
    return {
      top: lerpColor([25, 50, 120],  [55, 110, 200], t),
      bot: lerpColor([220, 130, 60], [185, 155, 120], t),
    };
  }

  // Päivä (6 … 60°) — kesä vs talvi eri sininen
  const t = Math.min((alt - 6) / 50, 1);
  const winterTop = [80, 120, 200];
  const summerTop = [30, 100, 210];
  const topBase = (month >= 4 && month <= 8) ? summerTop : winterTop;
  return {
    top: lerpColor(topBase,          [20, 75, 175],  t),
    bot: lerpColor([160, 200, 240],  [110, 165, 220], t),
  };
}

export function drawSky(ctx, w, h, isDay, isTwilight, month, altitude = null) {
  // altitude välitetään suoraan jos saatavissa, muuten arvataan
  const alt = altitude !== null ? altitude
    : isDay ? 20 : isTwilight ? -3 : -15;

  const pal = skyPalette(alt, month);

  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.73);
  grad.addColorStop(0, rgb(pal.top));
  grad.addColorStop(1, rgb(pal.bot));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Ilmakehän sirontavivahdus horisontin lähellä
  const hazeGrad = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.73);
  hazeGrad.addColorStop(0, "rgba(255,255,255,0)");
  if (isDay) {
    hazeGrad.addColorStop(1, "rgba(200,220,255,0.18)");
  } else if (isTwilight) {
    hazeGrad.addColorStop(1, "rgba(255,160,80,0.22)");
  } else {
    hazeGrad.addColorStop(1, "rgba(20,30,60,0.0)");
  }
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, 0, w, h * 0.73);
}

export function drawSun(ctx, w, h, altitude, azimuth) {
  if (altitude < -5) return;

  const alpha = Math.min(1, (altitude + 5) / 6);

  // Asimutista x-koordinaatti (0–360° → 0–w)
  const sx = (azimuth / 360) * w;

  // Korkeus → y: 0° = horisontti (h*0.72), max ~60° = h*0.10
  const maxAlt = 55;
  const sy = lerp(h * 0.72, h * 0.08, Math.max(0, altitude) / maxAlt);

  const isLow  = altitude < 8;
  const sunR   = isLow ? 13 : lerp(13, 9, Math.min(1, (altitude - 8) / 40));

  // Litistyminen horisontilla (refraktio)
  const squish = isLow ? lerp(0.60, 1.0, altitude < 0 ? 0 : altitude / 8) : 1.0;

  // Väri korkeuden mukaan
  const diskColor = altitude < 1  ? "#ff8010"
                  : altitude < 5  ? "#ffaa20"
                  : altitude < 15 ? "#ffcc40"
                  :                 "#ffe878";

  // Ulompi ambient-hehku
  const gR1 = sunR * (isLow ? 9 : 5);
  const g1 = ctx.createRadialGradient(sx, sy, sunR * 0.4, sx, sy, gR1);
  const glowRGB = altitude < 5 ? "255,130,40" : "255,210,100";
  g1.addColorStop(0, `rgba(${glowRGB},${alpha * (isLow ? 0.45 : 0.28)})`);
  g1.addColorStop(0.5, `rgba(${glowRGB},${alpha * 0.08})`);
  g1.addColorStop(1, `rgba(${glowRGB},0)`);
  ctx.beginPath();
  ctx.arc(sx, sy, gR1, 0, Math.PI * 2);
  ctx.fillStyle = g1;
  ctx.fill();

  // Sisempi kirkas sydän-hehku
  const gR2 = sunR * 2.2;
  const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, gR2);
  g2.addColorStop(0, `rgba(255,255,220,${alpha * 0.9})`);
  g2.addColorStop(0.4, `rgba(255,230,140,${alpha * 0.5})`);
  g2.addColorStop(1, `rgba(255,200,80,0)`);
  ctx.beginPath();
  ctx.ellipse(sx, sy, gR2, gR2 * squish, 0, 0, Math.PI * 2);
  ctx.fillStyle = g2;
  ctx.fill();

  // Auringon kiekko
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.ellipse(sx, sy, sunR, sunR * squish, 0, 0, Math.PI * 2);
  ctx.fillStyle = diskColor;
  ctx.fill();
  ctx.restore();

  // Horisonttiviiva-hehku kun aurinko on lähellä horisonttia
  if (altitude < 12) {
    const gi = lerp(0.7, 0, altitude / 12);
    const hg = ctx.createRadialGradient(sx, h * 0.72, 0, sx, h * 0.72, w * 0.45);
    hg.addColorStop(0, `rgba(255,160,50,${gi * 0.65})`);
    hg.addColorStop(0.3, `rgba(255,90,20,${gi * 0.22})`);
    hg.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, h * 0.62, w, h * 0.15);
  }
}

// Auringon ratakäyrä (katkoviiva)
export function drawSunPath(ctx, w, h, pathPoints) {
  if (!pathPoints || pathPoints.length < 2) return;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "rgba(255,220,100,0.8)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  let first = true;
  pathPoints.forEach(({ alt, az }) => {
    if (alt < -8) { first = true; return; }
    const px = (az / 360) * w;
    const py = lerp(h * 0.72, h * 0.08, Math.max(0, alt) / 55);
    if (first) { ctx.moveTo(px, py); first = false; } else { ctx.lineTo(px, py); }
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}