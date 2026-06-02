import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import useTranslation from "../hooks/useTranslation";

const BASE =
  import.meta.env.VITE_API_BASE ||
  "https://report.masto84.workers.dev";

const SIGHTINGS_CACHE_KEY = "aurora_session_cache:sightings:clusters:v1";
const SIGHTINGS_TTL_MS = 10 * 60 * 1000; // 10 min

function readPremium() {
  try {
    const p = JSON.parse(
      localStorage.getItem("aurora_premium") || "null"
    );

    if (!p || !p.deviceKey || !p.expiresAt) {
      return null;
    }

    if (p.expiresAt < Date.now()) {
      return null;
    }

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

    if (!cached || typeof cached.savedAt !== "number") {
      return null;
    }

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
    sessionStorage.setItem(
      key,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      })
    );
  } catch {
    // sessionStorage voi olla täynnä/estetty — ei kaadeta sivua.
  }
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

export default function Sightings() {
  const [clusters, setClusters] = useState([]);

  const { t } = useTranslation();
  const navigate = useNavigate();

  const premium = useMemo(() => readPremium(), []);

  const loadClusters = useCallback(
    async ({ force = false } = {}) => {
      // Free-käyttäjä ei kuluta Workeria.
      if (!premium) return;

      try {
        const data = await sessionCachedJson(
          SIGHTINGS_CACHE_KEY,
          SIGHTINGS_TTL_MS,
          async () => {
            const res = await fetch(`${BASE}/api/sightings/clusters`, {
              cache: "default",
            });

            if (!res.ok) {
              throw new Error(`sightings ${res.status}`);
            }

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

    const interval = setInterval(() => {
      loadClusters({ force: true });
    }, SIGHTINGS_TTL_MS);

    window.__refreshSightings = () => {
      loadClusters({ force: true });
    };

    return () => {
      clearInterval(interval);
      delete window.__refreshSightings;
    };
  }, [loadClusters, premium]);

  // FREE upsell — ei Worker-kutsua.
  if (!premium) {
    return (
      <div className="sightings-empty">
        🔒{" "}
        {t("sightings.premiumRequired") ||
          "Premium required to view live aurora sightings"}
      </div>
    );
  }

  return (
    <div className="sightings-list">
      {clusters.length === 0 ? (
        <div className="sightings-empty">
          {t("sightings.empty")}
        </div>
      ) : (
        clusters.map((c, i) => (
          <div
            key={`${c.region}-${c.latestTs || i}`}
            className="sighting-row"
            onClick={() => {
              navigate(
                `/map?lat=${c.lat}&lon=${c.lon}&sighting=1`
              );
            }}
            style={{
              cursor: "pointer",
            }}
          >
            <div className="sighting-main">
              <div className="sighting-place">
                📍 {c.region}
              </div>

              <div className="sighting-time">
                {c.minutesAgo} min ago
              </div>
            </div>

            <div className="sighting-meta">
              <div className="sighting-item">
                <span className="label">
                  Reports
                </span>

                <span className="value">
                  {c.count}
                </span>
              </div>

              <div className="sighting-item">
                <span className="label">
                  Status
                </span>

                <span className="value">
                  Active
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}