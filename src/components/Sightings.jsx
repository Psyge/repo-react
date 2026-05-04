import { useEffect, useState } from "react";

export default function Sightings() {
  const [clusters, setClusters] = useState([]);

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
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sightings">
      {clusters.length === 0 ? (
        <div className="sightings-empty">
          No active sightings right now
        </div>
      ) : (
        clusters.map((c, i) => (
          <div key={i} className="sighting-row">
            <span className="sighting-region">
              📍 {c.region}
            </span>

            <span className="sighting-meta">
              {c.count} reports · {c.minutesAgo} min
            </span>
          </div>
        ))
      )}
    </div>
  );
}