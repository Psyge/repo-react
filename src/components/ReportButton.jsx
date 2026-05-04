export default function ReportButton() {
  const BASE = "https://report.masto84.workers.dev";

  const report = async () => {
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await fetch(`${BASE}/api/sightings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          }),
        });

        alert("Reported!");
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button onClick={report} className="report-btn">
      Report sighting
    </button>
  );
}