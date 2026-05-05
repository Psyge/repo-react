import useTranslation from "../hooks/useTranslation";

export default function ReportButton() {
  const BASE = "https://report.masto84.workers.dev";
  const { t } = useTranslation();

  const report = () => {
    if (!navigator.geolocation) {
      alert(t("sightings.geo_denied"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`${BASE}/api/sightings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            }),
          });

          if (res.status === 429) {
            alert(t("sightings.cooldown"));
            return;
          }

          if (!res.ok) throw new Error("fail");

          alert(t("sightings.thanks"));
        } catch (e) {
          console.error(e);
          alert(t("sightings.error"));
        }
      },
      () => {
        alert(t("sightings.geo_denied"));
      }
    );
  };

  return (
    <button onClick={report} className="btn-primary">
      {t("sightings.report_btn")}
    </button>
  );
}