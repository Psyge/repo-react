/**
 * Aurora Premium — React-friendly client helper.
 * Pure ES module port of public/v2/js/premium.js.
 *
 * Usage:
 *   import { isActive, openCheckout, activate, bySession, read } from "@/lib/premium";
 */

// Backend URL — same as window.AURORA_CONFIG.REPORT_WORKER_URL
const BASE = "https://report.masto84.workers.dev";
const LS_KEY = "aurora_premium";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h

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
    const data = await res.json();
    if (data.active) {
      write({ ...p, expiresAt: data.expiresAt, tier: data.tier, lastCheck: Date.now() });
    } else {
      write(null);
    }
    return data;
  } catch (e) {
    console.warn("[premium] refresh failed", e);
    return { active: isActive() };
  }
}

export async function activate(token) {
  const res = await fetch(`${BASE}/api/premium/activate?token=${encodeURIComponent(token)}`);
  const data = await res.json();
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
  const data = await res.json();
  if (!res.ok || !data.url) {
    alert((data && data.detail) || "Checkout could not be started.");
    return;
  }
  window.location.href = data.url;
}

export async function bySession(sessionId, { maxAttempts = 30, intervalMs = 2000 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${BASE}/api/premium/by-session?session_id=${encodeURIComponent(sessionId)}`,
    );
    const data = await res.json().catch(() => ({}));
    if (data.ready && data.token) return data.token;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timeout waiting for payment confirmation");
}

export { read };

// Init on import (browser only)
if (typeof window !== "undefined") {
  if (isActive()) document.body.classList.add("is-premium");
  const p = read();
  if (p && (!p.lastCheck || Date.now() - p.lastCheck > CHECK_INTERVAL_MS)) {
    refresh().then((d) => {
      if (d.active) document.body.classList.add("is-premium");
      else document.body.classList.remove("is-premium");
    });
  }
}
