import { useState } from "react";
import useTranslation from "../hooks/useTranslation";

const BASE = "https://report.masto84.workers.dev";

// Cloudflare Turnstile site key
const TURNSTILE_SITE_KEY = "0x4AAAAAADF29-_iSqwRQWf2";

// widget pysyy muistissa
let widgetId = null;
let executing = false;

export default function ReportButton() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);

  // ===== Get invisible Turnstile token
  const getTurnstileToken = () => {
    return new Promise((resolve, reject) => {
      try {
        if (!window.turnstile) {
          reject(new Error("Turnstile not loaded"));
          return;
        }

        if (executing) {
          reject(new Error("Turnstile already running"));
          return;
        }

        executing = true;

        // renderöi vain kerran
        if (widgetId === null) {
          widgetId = window.turnstile.render(
            "#turnstile-container",
            {
              sitekey: TURNSTILE_SITE_KEY,
              size: "invisible",

              callback: (token) => {
                executing = false;
                resolve(token);
              },

              "error-callback": () => {
                executing = false;
                reject(new Error("Turnstile failed"));
              },

              "expired-callback": () => {
                executing = false;
                reject(new Error("Turnstile expired"));
              },
            }
          );
        } else {
          // resetoi vanha captcha
          window.turnstile.reset(widgetId);
        }

        // suorita captcha
        window.turnstile.execute(widgetId);
      } catch (err) {
        executing = false;
        reject(err);
      }
    });
  };

  const report = async () => {
    if (loading) return;

    if (!navigator.geolocation) {
      alert(t("sightings.geo_denied"));
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          // ===== Get captcha token
          const turnstileToken =
            await getTurnstileToken();

          const payload = {
            lat: Number(pos.coords.latitude),
            lon: Number(pos.coords.longitude),

            createdAt: Date.now(),
            source: "web",

            turnstileToken,
          };

          const res = await fetch(
            `${BASE}/api/sightings`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
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

          // refresh sightings lista
          if (window.__refreshSightings) {
            window.__refreshSightings();
          }

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
    <>
      <div
        id="turnstile-container"
        style={{ display: "none" }}
      />

      <button
        onClick={report}
        className="btn-primary"
        disabled={loading}
      >
        {loading
          ? t("common.loading") || "Loading..."
          : t("sightings.report_btn")}
      </button>
    </>
  );
}