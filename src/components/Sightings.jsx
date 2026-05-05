import { useEffect, useState } from "react";
import useTranslation from "../hooks/useTranslation";

export default function Sightings() {
  const [clusters, setClusters] = useState([]);
  const { t } = useTranslation();

  const BASE = "https://report.masto84.workers.dev";

  const loadClusters = async () => {
    try {
      const res = await fetch(`${BASE}/api/sightings/clusters`, {
        cache: "no-cache",
      });

      const data = await res.json();
      setClusters(data.clusters || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadClusters();

    const interval = setInterval(loadClusters, 120000);

    // 🔥 mahdollistaa report-napin refreshin
    window.__refreshSightings = loadClusters;

    return () => {
      clearInterval(interval);
      delete window.__refreshSightings;
    };
  }, []);

  return (
    <div className="sightings">
      {clusters.length === 0 ? (
        <div className="sightings-empty">
          {t("sightings.empty")}
        </div>
      ) : (
        clusters.map((c, i) => (
          <div key={i} className="sighting-row">
            <span className="sighting-region">
              📍 {c.region}
            </span>

            <span className="sighting-meta">
              {c.count} {t("sightings.reports")} · {c.minutesAgo} min
            </span>
          </div>
        ))
      )}
    </div>
  );
}