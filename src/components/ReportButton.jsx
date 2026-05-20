import { useRef, useState } from "react";
import useTranslation from "../hooks/useTranslation";

const BASE = "https://report.masto84.workers.dev";

const TURNSTILE_SITE_KEY =
  "0x4AAAAAADF29-_iSqwRQWf2";

export default function ReportButton() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);

  const tokenRef = useRef(null);

  const report = async () => {
    if (loading) return;

    if (!tokenRef.current) {
      alert("Complete captcha first");
      return;
    }

    if (!navigator.geolocation) {
      alert(t("sightings.geo_denied"));
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const payload = {
            lat: Number(pos.coords.latitude),
            lon: Number(pos.coords.longitude),

            createdAt: Date.now(),
            source: "web",

            turnstileToken:
              tokenRef.current,
          };

          const res = await fetch(
            `${BASE}/api/sightings`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(payload),
            }
          );

          const text = await res.text();

          console.log(
            "sighting response:",
            res.status,
            text
          );

          if (res.status === 429) {
            alert(t("sightings.cooldown"));
            return;
          }

          if (!res.ok) {
            throw new Error(
              text || "Request failed"
            );
          }

          alert(t("sightings.thanks"));

          if (
            window.__refreshSightings
          ) {
            window.__refreshSightings();
          }

          tokenRef.current = null;

          window.turnstile.reset();
        } catch (err) {
          console.error(
            "REPORT ERROR:",
            err
          );

          alert(t("sightings.error"));
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error(err);

        alert(t("sightings.geo_denied"));

        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        className="cf-turnstile"
        data-sitekey={
          TURNSTILE_SITE_KEY
        }
        data-theme="dark"
        data-callback={(token) => {
          tokenRef.current = token;
        }}
      />

      <button
        onClick={report}
        className="btn-primary"
        disabled={loading}
      >
        {loading
          ? "Loading..."
          : t("sightings.report_btn")}
      </button>
    </div>
  );
}