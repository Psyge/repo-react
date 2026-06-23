/**
 * Aurora Premium — React-friendly client helper.
 * Updated: installId-based activation + env API base + safer polling.
 *
 * Usage:
 *   import { isActive, openCheckout, activate, bySession, read } from "@/lib/premium";
 */

const BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  "https://report.masto84.workers.dev";

const LS_KEY = "aurora_premium";
const INSTALL_KEY = "aurora_install_id";
const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000; // 1h

function read() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch {
    return null;
  }
}

function write(v) {
  if (typeof window === "undefined") return;
  if (v) localStorage.setItem(LS_KEY, JSON.stringify(v));
  else localStorage.removeItem(LS_KEY);
}

function getOrCreateInstallId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(INSTALL_KEY);
  if (id) return id;

  id =
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  localStorage.setItem(INSTALL_KEY, id);
  return id;
}

export function isActive() {
  const p = read();
  if (!p || !p.deviceKey || !p.expiresAt) return false;
  return p.expiresAt > Date.now();
}

export async function refresh() {
  const p = read();
  if (!p || !p.deviceKey) return { active: false };

  try {
    const res = await fetch(`${BASE}/api/premium/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceKey: p.deviceKey }),
    });

    const data = await res.json().catch(() => ({}));

    // Jos backend vastasi onnistuneesti:
    if (res.ok) {
      if (data.active) {
        write({
          ...p,
          expiresAt: data.expiresAt,
          tier: data.tier,
          lastCheck: Date.now(),
        });
      } else {
        // oikea inactive -> tyhjennä
        write(null);
      }
      return data;
    }

    // 429 / 5xx / muu -> älä tiputa local premiumia heti
    return { active: isActive(), transient: true, status: res.status };
  } catch (e) {
    console.warn("[premium] refresh failed", e);
    return { active: isActive(), transient: true };
  }
}

export async function activate(token) {
  const installId = getOrCreateInstallId();

  const res = await fetch(
    `${BASE}/api/premium/activate?token=${encodeURIComponent(token)}&installId=${encodeURIComponent(installId)}`
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || data.error || "Activation failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }

  write({
    deviceKey: data.deviceKey,
    expiresAt: data.expiresAt,
    tier: data.tier,
    lastCheck: Date.now(),
  });

  if (typeof document !== "undefined") document.body.classList.add("is-premium");
  return data;
}

export async function openCheckout(tier) {
  const res = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.url) {
    if (res.status === 429) {
      alert("Too many requests. Please wait a moment and try again.");
      return;
    }
    alert((data && (data.detail || data.error)) || "Checkout could not be started.");
    return;
  }

  window.location.href = data.url;
}

export async function bySession(
  sessionId,
  { maxAttempts = 20, intervalMs = 1500, maxIntervalMs = 5000 } = {}
) {
  let wait = intervalMs;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${BASE}/api/premium/by-session?session_id=${encodeURIComponent(sessionId)}`
    );

    const data = await res.json().catch(() => ({}));

    if (data.ready && data.token) return data.token;

    // 202 = webhook not ready, 429 = throttle; backoff hieman
    if (res.status === 429) {
  wait = Math.min(maxIntervalMs, wait + 500);
}

const delay = wait;

await new Promise((resolve) =>
  setTimeout(resolve, delay)
);
  }

  throw new Error("Timeout waiting for payment confirmation");
}

export { read, getOrCreateInstallId };

// Init on import (browser only)
if (typeof window !== "undefined") {
  if (isActive()) document.body.classList.add("is-premium");

  // varmista, että installId on olemassa jo ennen activation-sivua
  getOrCreateInstallId();

  const p = read();
  if (p && (!p.lastCheck || Date.now() - p.lastCheck > CHECK_INTERVAL_MS)) {
    refresh().then((d) => {
      if (d.active) document.body.classList.add("is-premium");
      else if (!d.transient) document.body.classList.remove("is-premium");
    });
  }
}