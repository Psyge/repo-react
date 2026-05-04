// auroraEngine.js

function scoreKp(kp) {
  if (kp == null) return 0;
  return Math.min(100, (kp / 9) * 100);
}

function scoreBz(bz) {
  if (bz == null) return 0;
  if (bz >= 0) return 0;
  return Math.min(100, (Math.abs(bz) / 15) * 100);
}

function scoreSpeed(s) {
  if (s == null) return 0;
  if (s < 300) return 0;
  return Math.min(100, ((s - 300) / 500) * 100);
}

function scoreDensity(d) {
  if (d == null) return 0;
  return Math.min(100, (d / 20) * 100);
}

function scoreClouds(c) {
  if (c == null) return 50;
  return Math.max(0, 100 - c);
}

function scoreLatitude(lat, kp) {
  if (lat == null) return 50;
  const auroralLat = 67 - (kp || 0) * 1.5;
  const diff = Math.abs(lat - auroralLat);
  return Math.max(0, 100 - diff * 10);
}

// 🔥 TÄMÄ ON SE MITÄ KÄYTÄT
export function calculateAurora(input) {
  const { kp, speed, density, bz, cloudCover, latitude, ovation } = input;

  let score =
    scoreKp(kp) * 0.35 +
    scoreBz(bz) * 0.25 +
    scoreSpeed(speed) * 0.15 +
    scoreDensity(density) * 0.1 +
    scoreClouds(cloudCover) * 0.1 +
    scoreLatitude(latitude, kp) * 0.05;

  let ovationProb = null;

  if (ovation != null && !isNaN(ovation)) {
    const cloudVis = cloudCover != null ? (100 - cloudCover) / 100 : 0.7;
    ovationProb = Math.min(100, (ovation / 50) * 100) * cloudVis;
    score = Math.max(score, ovationProb);
  }

  if (kp != null && !isNaN(kp)) {
    let kpCap = kp < 4 ? 5 + kp * 11.25 : 100;
    if (ovationProb != null) kpCap = Math.max(kpCap, ovationProb);
    score = Math.min(score, kpCap);
  } else if (ovationProb == null) {
    score = 0;
  }

  const probability = Math.round(score);

  let level = "low";
  if (probability >= 75) level = "veryhigh";
  else if (probability >= 50) level = "high";
  else if (probability >= 25) level = "medium";

  return { probability, level };
}