/* ============================================================
 * globeMath.js — puhtaat laskenta-apurit globeen.
 * Ei Reactia, ei verkkohakuja, ei sivuvaikutuksia.
 * Sijainti: src/utils/Globemath.js
 * ============================================================ */

/* Laitteen kyvykkyys: high = täydet efektit, low = kevennetty */
export function getGlobeQuality() {
  if (typeof window === "undefined") return "low";
  const c = navigator.connection || navigator.webkitConnection || {};
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (c.saveData) return "low";
  if (c.effectiveType && !/4g/i.test(c.effectiveType)) return "low";
  if (cores < 6 || mem < 6) return "low";
  return "high";
}

/* Pystyykö laite ylipäätään renderöimään globen (muuten 2D-fallback) */
export function deviceCanRenderGlobe() {
  if (typeof window === "undefined") return false;
  const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (rm && rm.matches) return false;
  const c = navigator.connection || navigator.webkitConnection || {};
  if (c.saveData) return false;
  if (c.effectiveType && !/4g/i.test(c.effectiveType)) return false;
  const cores = navigator.hardwareConcurrency;
  if (cores && cores < 4) return false;
  const mem = navigator.deviceMemory;
  if (mem != null && mem < 4) return false;
  try {
    const cv = document.createElement("canvas");
    if (!(cv.getContext("webgl2") || cv.getContext("webgl"))) return false;
  } catch {
    return false;
  }
  return true;
}

/* Revontulien väriskaala: pelkkiä vihreän sävyjä — himmeästä tummanvihreästä
 * kirkkaaseen, huipussa lähes valkovihreä hehku. */
export function getAuroraColor(t) {
  const stops = [
    [0.00, [0, 170, 80, 0]],
    [0.06, [0, 190, 95, 0.28]],
    [0.30, [0, 225, 110, 0.55]],
    [0.55, [60, 250, 125, 0.72]],
    [0.80, [140, 255, 150, 0.85]],
    [1.00, [215, 255, 200, 0.95]]
  ];
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const t0 = stops[i - 1][0], c0 = stops[i - 1][1];
      const t1 = stops[i][0], c1 = stops[i][1];
      const f = (t - t0) / ((t1 - t0) || 1);
      const ch = (k) => Math.round(c0[k] + (c1[k] - c0[k]) * f);
      const a = c0[3] + (c1[3] - c0[3]) * f;
      return `rgba(${ch(0)},${ch(1)},${ch(2)},${a.toFixed(3)})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgba(${last[0]},${last[1]},${last[2]},${last[3]})`;
}

/* ---- Yön raja (terminaattori) ----
 * Auringon aliaurinkopiste lasketaan ajasta, ja terminaattori on
 * isoympyrä 90° päässä siitä. */
export function subsolarPoint(date = new Date()) {
  const rad = Math.PI / 180;
  const dayMs = 86400000, J1970 = 2440588, J2000 = 2451545;
  const days = date.valueOf() / dayMs - 0.5 + J1970 - J2000;
  const e = rad * 23.4397;
  const M = rad * (357.5291 + 0.98560028 * days);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(L) * Math.sin(e));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const theta = rad * (280.16 + 360.9856235 * days);
  let lng = ((ra - theta) / rad) % 360;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return { lat: dec / rad, lng };
}

/* Isoympyräetäisyys kilometreinä. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* Auringon korkeuskulma asteina annetussa pisteessä.
 * < -6°  = siviilihämärän jälkeen, all-sky-kamerat kuvaavat
 * < -12° = nautical twilight, revontulet erottuvat hyvin */
export function sunAltitudeAt(lat, lon, date = new Date()) {
  const rad = Math.PI / 180;
  const sub = subsolarPoint(date);
  const phi = lat * rad;
  const dec = sub.lat * rad;
  const H = (lon - sub.lng) * rad;
  const sinAlt =
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
}

export function buildTerminator(date = new Date()) {
  const sub = subsolarPoint(date);
  const rad = Math.PI / 180;
  const s = [
    Math.cos(sub.lat * rad) * Math.cos(sub.lng * rad),
    Math.cos(sub.lat * rad) * Math.sin(sub.lng * rad),
    Math.sin(sub.lat * rad),
  ];
  // u = s × pohjoisnapa (normalisoituna), v = s × u → terminaattorin taso
  let ux = s[1], uy = -s[0];
  const ulen = Math.hypot(ux, uy) || 1;
  ux /= ulen; uy /= ulen;
  const uz = 0;
  const vx = s[1] * uz - s[2] * uy;
  const vy = s[2] * ux - s[0] * uz;
  const vz = s[0] * uy - s[1] * ux;

  const pts = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 2 * Math.PI;
    const px = ux * Math.cos(t) + vx * Math.sin(t);
    const py = uy * Math.cos(t) + vy * Math.sin(t);
    const pz = uz * Math.cos(t) + vz * Math.sin(t);
    pts.push([Math.asin(pz) / rad, Math.atan2(py, px) / rad]);
  }
  return pts; // [[lat, lng], ...] — paths-layerin oletusaccessorit lukevat tämän
}