/**
 * groundRenderer.js
 * Sama rajapinta: drawGround(ctx, w, h, month)
 */

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// Kuusi-silhuetti yhdellä piirtokutsulla
function drawSpruce(ctx, x, baseY, treeH, treeW) {
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  // Kolme kerrosta
  ctx.lineTo(x - treeW * 0.48, baseY - treeH * 0.42);
  ctx.lineTo(x - treeW * 0.32, baseY - treeH * 0.42);
  ctx.lineTo(x - treeW * 0.62, baseY - treeH * 0.70);
  ctx.lineTo(x - treeW * 0.38, baseY - treeH * 0.70);
  ctx.lineTo(x - treeW * 0.22, baseY - treeH * 0.84);
  ctx.lineTo(x, baseY - treeH);
  ctx.lineTo(x + treeW * 0.22, baseY - treeH * 0.84);
  ctx.lineTo(x + treeW * 0.38, baseY - treeH * 0.70);
  ctx.lineTo(x + treeW * 0.62, baseY - treeH * 0.70);
  ctx.lineTo(x + treeW * 0.32, baseY - treeH * 0.42);
  ctx.lineTo(x + treeW * 0.48, baseY - treeH * 0.42);
  ctx.closePath();
}

export function drawGround(ctx, w, h, month) {
  const hY = h * 0.72;

  // ---- Maapaletti vuodenajan mukaan ----
  const isWinter = [11, 0, 1].includes(month);
  const isSpring = [2, 3].includes(month);
  const isSummer = [4, 5, 6, 7].includes(month);
  // syksy = muu

  const groundColors = isWinter ? {
    near:   "#c8dae8",  // lumi lähellä
    far:    "#a0b8cc",  // lumi kaukana
    shadow: "#4a6070",  // varjot
    tree:   "#1e2e3a",  // kuuset tummia
    treeFar: "#2a3e50",
  } : isSpring ? {
    near:   "#7a8a60",
    far:    "#5a6a44",
    shadow: "#2a3220",
    tree:   "#1e3018",
    treeFar: "#283820",
  } : isSummer ? {
    near:   "#2a6820",  // rehevä vihreä
    far:    "#1e5018",
    shadow: "#0c2008",
    tree:   "#0a2208",
    treeFar: "#122a0c",
  } : {                  // syksy
    near:   "#8a5028",
    far:    "#5a3018",
    shadow: "#281408",
    tree:   "#1c1008",
    treeFar: "#281810",
  };

  // ---- Maaperä: 3-stop liukuväri ----
  const groundGrad = ctx.createLinearGradient(0, hY, 0, h);
  groundGrad.addColorStop(0,    groundColors.far);
  groundGrad.addColorStop(0.35, groundColors.near);
  groundGrad.addColorStop(1,    groundColors.shadow);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, hY, w, h - hY);

  // ---- Lumipinturefleksio talvella ----
  if (isWinter) {
    const snowSheen = ctx.createLinearGradient(0, hY, 0, hY + 60);
    snowSheen.addColorStop(0, "rgba(255,255,255,0.18)");
    snowSheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = snowSheen;
    ctx.fillRect(0, hY, w, 60);
  }

  // ---- Kaukainen metsärivi (pieni, vaalea) ----
  const farTreeCount = Math.floor(w / 18);
  ctx.fillStyle = groundColors.treeFar;
  for (let i = 0; i < farTreeCount; i++) {
    const tx  = (i / farTreeCount) * w + Math.sin(i * 5.1) * 6;
    const th  = 18 * (0.7 + Math.sin(i * 2.9) * 0.3);
    const tw  = 5  + Math.sin(i * 1.7) * 1.5;
    drawSpruce(ctx, tx, hY, th, tw);
    ctx.fill();
  }

  // ---- Lähimetsärivi (iso, tumma) ----
  const nearTreeCount = Math.floor(w / 26);
  ctx.fillStyle = groundColors.tree;
  for (let i = 0; i < nearTreeCount; i++) {
    const tx  = (i / nearTreeCount) * w + Math.sin(i * 7.3) * 9 + 13;
    const th  = 42 * (0.65 + Math.sin(i * 3.7) * 0.35);
    const tw  = 10 + Math.sin(i * 2.1) * 3;
    drawSpruce(ctx, tx, hY, th, tw);
    ctx.fill();
  }

  // ---- Talvi: lunta puissa ----
  if (isWinter) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ddeeff";
    for (let i = 0; i < nearTreeCount; i++) {
      const tx = (i / nearTreeCount) * w + Math.sin(i * 7.3) * 9 + 13;
      const th = 42 * (0.65 + Math.sin(i * 3.7) * 0.35);
      const tw = 10 + Math.sin(i * 2.1) * 3;
      // Lumi vain latvaan
      ctx.beginPath();
      ctx.moveTo(tx - tw * 0.22, hY - th * 0.84);
      ctx.lineTo(tx, hY - th);
      ctx.lineTo(tx + tw * 0.22, hY - th * 0.84);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}