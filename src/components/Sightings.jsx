import { useCallback, } from "react";
import { useNavigate } from "react-router-dom";

import useTranslation from "../hooks/useTranslation";


function readPremium() {
  try {
    const p = JSON.parse(
      localStorage.getItem(
        "aurora_premium"
      ) || "null"
    );

    if (
      !p ||
      !p.deviceKey ||
      !p.expiresAt
    ) {
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

export default function Sightings() {
  const [clusters, setClusters] =
    useState([]);

  
  const { t } = useTranslation();

  const navigate = useNavigate();

  const BASE =
    "https://report.masto84.workers.dev";

  const premium = readPremium();

 const loadClusters = useCallback(
  async () => {
    // FREE users ei näe sightings-listaa
   

    try {
      const res = await fetch(
        `${BASE}/api/sightings/clusters`,
        {
          cache: "no-cache",
        }
      );

      const data = await res.json();

      setClusters(
        data.clusters || []
      );
    } catch (e) {
      console.error(e);
    }
  },
  []
);

  useEffect(() => {
    loadClusters();

    const interval =
      setInterval(
        loadClusters,
        120000
      );

    window.__refreshSightings =
      loadClusters;

    return () => {
      clearInterval(interval);

      delete window.__refreshSightings;
    };
  }, [loadClusters]);

  // FREE upsell
  if (!premium) {
  const totalReports = clusters.reduce((sum, c) => sum + c.count, 0);
  return (
    <div className="sightings-empty">
      {totalReports > 0
        ? `🌌 ${totalReports} ${t("sightings.reportsActive") || "aurora report(s) active right now"} — 🔒 ${t("sightings.unlockDetails") || "Unlock Premium to see locations"}`
        : `🔒 ${t("sightings.premiumRequired") || "Premium required to view live aurora sightings"}`
      }
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
            key={i}
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