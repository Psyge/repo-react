import useTranslation from "../hooks/useTranslation";

const BASE = "https://report.masto84.workers.dev";

export default function ReportButton() {
  const { t } = useTranslation();

  const report = async () => {
    if (!navigator.geolocation) {
      alert(t("sightings.geo_denied"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const payload = {
            lat: Number(pos.coords.latitude),
            lon: Number(pos.coords.longitude),

            // uudempi backend yleensä tarvitsee timestampin
            createdAt: Date.now(),

            // joskus worker tarkistaa source-kentän
            source: "web",
          };

          const res = await fetch(`${BASE}/api/sightings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          // DEBUG
          const text = await res.text();
          console.log("sighting response:", res.status, text);

          if (res.status === 429) {
            alert(t("sightings.cooldown"));
            return;
          }

          if (!res.ok) {
            throw new Error(text || "Request failed");
          }

          alert(t("sightings.thanks"));
        } catch (err) {
          console.error("REPORT ERROR:", err);
          alert(t("sightings.error"));
        }
      },
      (err) => {
        console.error(err);
        alert(t("sightings.geo_denied"));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  return (
    <button onClick={report} className="btn-primary">
      {t("sightings.report_btn")}
    </button>
  );
}