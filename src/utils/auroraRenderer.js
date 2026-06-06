/**
 * auroraRenderer.js
 * Sama rajapinta: drawAurora(ctx, w, h, kp, cloudCover, time)
 */

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function drawAurora(ctx, w, h, kp, cloudCover, time) {
  if (!kp || kp < 2) return;

  const t        = time * 0.001;
  const strength = Math.min((kp - 1) / 7, 1);  // 0 @ kp=1, 1 @ kp=8
  const cloudFade = Math.max(0, 1 - cloudCover / 100);
  const baseAlpha = strength * cloudFade * 0.82;

  if (baseAlpha <= 0) return;

  ctx.save();

  // Kp määrää värin:
  // kp 2–3: vihreä
  // kp 4–5: vihreä + sinipurppura
  // kp 6+: purppura/puna-violetti lisääntyy
  const hueGreen  = 145;
  const huePurple = 285;
  const hueShift  = lerp(0, 1, Math.max(0, (kp - 4) / 4));
  const primaryHue   = lerp(hueGreen, huePurple, hueShift);
  const secondaryHue = lerp(160, 310, hueShift);

  const layerCount = Math.round(lerp(3, 6, strength));

  for (let layer = 0; layer < layerCount; layer++) {
    const lf     = layer / layerCount;
    const speed  = 0.28 + lf * 0.18;
    const yBase  = h * (0.08 + lf * 0.10);
    const amp1   = h * (0.06 + lf * 0.04);
    const amp2   = h * (0.03 + lf * 0.02);
    const freq1  = 0.008 + lf * 0.003;
    const freq2  = 0.003 + lf * 0.001;

    // Vaihteleva alpha per kaista
    const layerAlpha = baseAlpha * (0.35 + 0.65 * Math.sin(t * 0.4 + lf * 2.1));
    if (layerAlpha <= 0.01) continue;

    // Kaistan väri – vuorottelee pää- ja toissijaisen huen välillä
    const hue     = layer % 2 === 0 ? primaryHue : secondaryHue;
    const sat     = 75 + lf * 10;
    const light   = 52 + lf * 8;

    // Rakenna kaistan yläreuna pisteinä
    const points = [];
    const step   = Math.max(4, Math.floor(w / 160));
    for (let x = 0; x <= w; x += step) {
      const nx = x / w;
      const yo = Math.sin(nx * Math.PI * 4 + t * speed + lf * 1.8) * amp1
               + Math.sin(nx * Math.PI * 7 + t * speed * 0.6 + lf) * amp2;
      points.push({ x, y: yBase + yo });
    }

    // Kaistan korkeus kapenee reunoilla (verhomaisuus)
    const curtainH = h * (0.12 + lf * 0.06);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    // Alakaari – kaistaa alaspäin, aaltoileva alataso
    for (let i = points.length - 1; i >= 0; i--) {
      const p  = points[i];
      const nx = p.x / w;
      // Reunoilla kapenee
      const edgeFade = Math.sin(nx * Math.PI);
      ctx.lineTo(p.x, p.y + curtainH * edgeFade);
    }
    ctx.closePath();

    const aGrad = ctx.createLinearGradient(0, yBase - amp1, 0, yBase + curtainH);
    aGrad.addColorStop(0,   `hsla(${hue},${sat}%,${light}%,0)`);
    aGrad.addColorStop(0.2, `hsla(${hue},${sat}%,${light}%,${layerAlpha})`);
    aGrad.addColorStop(0.6, `hsla(${hue},${sat}%,${light * 0.8}%,${layerAlpha * 0.6})`);
    aGrad.addColorStop(1,   `hsla(${hue},${sat}%,${light * 0.5}%,0)`);

    ctx.fillStyle = aGrad;
    ctx.fill();
  }

  // Diffuusi taustahehku koko yläosaan (vahvistuu Kp:n myötä)
  if (kp >= 4) {
    const glowAlpha = lerp(0, 0.12, (kp - 4) / 5) * cloudFade;
    const bg = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    bg.addColorStop(0, `hsla(${primaryHue},70%,35%,${glowAlpha})`);
    bg.addColorStop(1, "hsla(150,60%,30%,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h * 0.5);
  }

  ctx.restore();
}