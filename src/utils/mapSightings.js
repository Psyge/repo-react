import L from "leaflet";

const BASE =
  "https://report.masto84.workers.dev";

export async function loadSightingsLayer(
  layer
) {
  try {
    const res = await fetch(
      `${BASE}/api/sightings/clusters`,
      {
        cache: "no-cache",
      }
    );

    const data = await res.json();

    layer.clearLayers();

    (data.clusters || []).forEach((c) => {
      if (
        c.lat == null ||
        c.lon == null
      ) {
        return;
      }

      const marker = L.circleMarker(
        [c.lat, c.lon],
        {
          radius: 18,

          color: "#ff4d6d",
          weight: 2,

          fillColor: "#ff4d6d",
          fillOpacity: 0.28,
        }
      );

      marker.bindPopup(`
        <div style="min-width:140px">
          <strong>${c.region}</strong><br/>
          ${c.count} reports<br/>
          ${c.minutesAgo} min ago
        </div>
      `);

      marker.addTo(layer);
    });
  } catch (err) {
    console.error(
      "[sightings layer]",
      err
    );
  }
}