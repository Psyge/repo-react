import useTranslation from "../hooks/useTranslation";

const BASE = "https://report.masto84.workers.dev";

// Cloudflare Turnstile site key
const TURNSTILE_SITE_KEY = "0x4AAAAAADF29-_iSqwRQWf2";

export default function ReportButton() {
  const { t } = useTranslation();

  // ===== Get invisible Turnstile token
  const getTurnstileToken = () => {
    return new Promise((resolve, reject) => {
      try {
        // poistetaan vanha widget jos olemassa
        const existing = document.getElementById("turnstile-container");

        if (existing) {
          existing.innerHTML = "";
        }

        const widgetId = window.turnstile.render(
          "#turnstile-container",
          {
            sitekey: TURNSTILE_SITE_KEY,
            size: "invisible",

            callback: (token) => {
              resolve(token);
            },

            "error-callback": () => {
              reject(new Error("Turnstile failed"));
            },

            "expired-callback": () => {
              reject(new Error("Turnstile expired"));
            },
          }
        );

        window.turnstile.execute(widgetId);
      } catch (err) {
        reject(err);
      }
    });
  };

  const report = async () => {
    if (!navigator.geolocation) {
      alert(t("sightings.geo_denied"));
      return;
    }

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

            // backend tarvitsee tämän
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
    <>
      <div
        id="turnstile-container"
        style={{ display: "none" }}
      />

      <button
        onClick={report}
        className="btn-primary"
      >
        {t("sightings.report_btn")}
      </button>
    </>
  );
}