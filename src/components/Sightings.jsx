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
    <section className="container">
      <h2>Latest sightings</h2>

      <div className="sightings">
        {clusters.length === 0 ? (
          <div className="sighting-card">
            No active sightings right now
          </div>
        ) : (
          clusters.map((c, i) => (
            <div key={i} className="sighting-card">
              📍 {c.region} — {c.count} reports · {c.minutesAgo} min
            </div>
          ))
        )}
      </div>
    </section>
  );
}