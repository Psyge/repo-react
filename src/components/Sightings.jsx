import { useState, useEffect, useCallback, useMemo } from "react";
import useTranslation from "../hooks/useTranslation";
import ReportButton from "./ReportButton";

/* ========================================================================
   SightingsBar  —  napakka korvike Sightings-listalle (hero-alueelle)

   Ei listaa paikkoja. Vasemmalla raportointinappi, oikealla tilayhteenveto:
     - premium + havaintoja  → "🟢 N havaintoa"  (+ viimeisin n min sitten)
     - premium + ei havaintoja → "Ei havaintoja juuri nyt"
     - free                   → "🔒 Premium — näe live-havainnot"

   Raportointi toimii kaikille (ReportButton). Vain havaintojen NÄKEMINEN
   on premium-ominaisuus, kuten ennenkin.
======================================================================== */

const BASE = import.meta.env.VITE_API_BASE || "";

const SIGHTINGS_CACHE_KEY = "aurora_session_cache:sightings:clusters:v1";
const SIGHTINGS_TTL_MS = 10 * 60 * 1000; // 10 min

function readPremium() {
  try {
    const p = JSON.parse(localStorage.getItem("aurora_premium") || "null");
    if (!p || !p.deviceKey || !p.expiresAt) return null;
    if (p.expiresAt < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

function readSessionCache(key, ttlMs) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached.savedAt !== "number") return null;
    if (ttlMs && Date.now() - cached.savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return cached.data ?? null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function writeSessionCache(key, data) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch { /* storage estetty */ }
}

async function sessionCachedJson(key, ttlMs, fetcher, { force = false } = {}) {
  if (!force) {
    const cached = readSessionCache(key, ttlMs);
    if (cached) return cached;
  }
  const data = await fetcher();
  writeSessionCache(key, data);
  return data;
}

export default function SightingsBar() {
  const { t } = useTranslation();
  const premium = useMemo(() => readPremium(), []);

  const [clusters, setClusters] = useState([]);

  const loadClusters = useCallback(
    async ({ force = false } = {}) => {
      if (!premium) return; // free ei kuluta Workeria
      try {
        const data = await sessionCachedJson(
          SIGHTINGS_CACHE_KEY,
          SIGHTINGS_TTL_MS,
          async () => {
            const res = await fetch(`${BASE}/api/sightings/clusters`, { cache: "default" });
            if (!res.ok) throw new Error(`sightings ${res.status}`);
            return res.json();
          },
          { force }
        );
        setClusters(data.clusters || []);
      } catch (e) {
        console.error(e);
      }
    },
    [premium]
  );

  useEffect(() => {
    if (!premium) {
      setClusters([]);
      return;
    }
    loadClusters();
    const interval = setInterval(() => loadClusters({ force: true }), SIGHTINGS_TTL_MS);
    window.__refreshSightings = () => loadClusters({ force: true });
    return () => {
      clearInterval(interval);
      delete window.__refreshSightings;
    };
  }, [loadClusters, premium]);

  // yhteenveto
  const totalCount = clusters.reduce((sum, c) => sum + (c.count || 0), 0);
  const latestMin = clusters.length
    ? Math.min(...clusters.map((c) => (typeof c.minutesAgo === "number" ? c.minutesAgo : Infinity)))
    : null;

  let status;
  if (!premium) {
    status = (
      <span className="ah-sb-status is-locked">
        🔒 {t("sightings.premiumShort") || "Premium — see live sightings"}
      </span>
    );
  } else if (totalCount > 0) {
    status = (
      <span className="ah-sb-status is-active">
        <span className="ah-sb-dot" />
        {String(t("sightings.countShort") || "{n} sightings").replace("{n}", totalCount)}
        {latestMin != null && Number.isFinite(latestMin) && (
          <span className="ah-sb-sub">
            {" · "}
            {String(t("sightings.latest") || "latest {m} min ago").replace("{m}", latestMin)}
          </span>
        )}
      </span>
    );
  } else {
    status = (
      <span className="ah-sb-status">
        {t("sightings.none") || "No sightings right now"}
      </span>
    );
  }

  return (
    <div className="ah-sightings-bar">
      <div className="ah-sb-left">
        <ReportButton />
      </div>
      <div className="ah-sb-right">{status}</div>
    </div>
  );
}