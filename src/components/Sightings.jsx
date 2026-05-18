import { useEffect, useState } from "react";
import useTranslation from "../hooks/useTranslation";

export default function Sightings() {
  const [clusters, setClusters] = useState([]);
  const { t } = useTranslation();

  const BASE = "https://report.masto84.workers.dev";

  const loadClusters = async () => {
    try {
      const res = await fetch(
        `${BASE}/api/sightings/clusters`,
        {
          cache: "no-cache",
        }
      );

      const data = await res.json();

      setClusters(data.clusters || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadClusters();

    const interval = setInterval(
      loadClusters,
      120000
    );

    window.__refreshSightings = loadClusters;

    return () => {
      clearInterval(interval);

      delete window.__refreshSightings;
    };
  }, []);

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