import { useState } from "react";
import useTranslation from "../hooks/useTranslation";

const BASE =
  import.meta.env.VITE_API_BASE ||
  "https://report.masto84.workers.dev";

const TURNSTILE_SITE_KEY =
  "0x4AAAAAADF29-_iSqwRQWf2";

export default function ReportButton() {
  const { t } = useTranslation();

  const [loading, setLoading] =
    useState(false);

  // ===== Invisible Turnstile
  const getTurnstileToken = async () => {
    return new Promise(
      (resolve, reject) => {
        let widgetId = null;

        const cleanup = () => {
          if (
            widgetId != null &&
            window.turnstile
          ) {
            try {
              window.turnstile.remove(
                widgetId
              );
            } catch {
              // ignore
            }
          }
        };

        try {
          if (!window.turnstile) {
            reject(
              new Error(
                "Turnstile not loaded"
              )
            );
            return;
          }

          const container =
            document.getElementById(
              "turnstile-container"
            );

          if (!container) {
            reject(
              new Error(
                "Turnstile container missing"
              )
            );
            return;
          }

          // tyhjennä vanha widget
          container.innerHTML = "";

          widgetId =
            window.turnstile.render(
              container,
              {
                sitekey:
                  TURNSTILE_SITE_KEY,

                size: "invisible",

                callback: (
                  token
                ) => {
                  resolve(token);

                  setTimeout(
                    cleanup,
                    0
                  );
                },

                "error-callback":
                  () => {
                    cleanup();

                    reject(
                      new Error(
                        "Turnstile failed"
                      )
                    );
                  },

                "expired-callback":
                  () => {
                    cleanup();

                    reject(
                      new Error(
                        "Turnstile expired"
                      )
                    );
                  },
              }
            );

          setTimeout(() => {
            try {
              window.turnstile.execute(
                widgetId
              );
            } catch (err) {
              cleanup();
              reject(err);
            }
          }, 50);
        } catch (err) {
          cleanup();
          reject(err);
        }
      }
    );
  };

  const report = async () => {
    if (loading) return;

    if (
      !navigator.geolocation
    ) {
      alert(
        t(
          "sightings.geo_denied"
        )
      );

      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const turnstileToken =
            await getTurnstileToken();

          const payload = {
            lat: Number(
              pos.coords.latitude
            ),

            lon: Number(
              pos.coords.longitude
            ),

            createdAt:
              Date.now(),

            source: "web",

            turnstileToken,
          };

          const res = await fetch(
            `${BASE}/api/sightings`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                payload
              ),
            }
          );

          const text =
            await res.text();

          if (
            res.status === 429
          ) {
            alert(
              t(
                "sightings.cooldown"
              )
            );

            return;
          }

          if (!res.ok) {
            throw new Error(
              text ||
                "Request failed"
            );
          }

          alert(
            t(
              "sightings.thanks"
            )
          );

          // Refresh sightings vain kerran.
          // Päivitetty Sightings/mapSightings voi käyttää force-refreshiä tämän takana.
          if (
            window.__refreshSightings
          ) {
            window.__refreshSightings();
          }
        } catch (err) {
          console.error(
            "REPORT ERROR:",
            err
          );

          alert(
            t(
              "sightings.error"
            )
          );
        } finally {
          setLoading(false);
        }
      },

      (err) => {
        console.error(err);

        alert(
          t(
            "sightings.geo_denied"
          )
        );

        setLoading(false);
      },

      {
        enableHighAccuracy: true,

        timeout: 10000,

        // Hyväksy viimeisen 5 min aikana haettu sijainti.
        // Tämä keventää selainpuolta eikä vaikuta Worker-kuluihin.
        maximumAge: 5 * 60 * 1000,
      }
    );
  };

  return (
    <>
      <div
        id="turnstile-container"
        style={{
          display: "none",
        }}
      />

      <button
        onClick={report}
        className="btn-primary"
        disabled={loading}
      >
        {loading
          ? t(
              "common.loading"
            ) || "Loading..."
          : t(
              "sightings.report_btn"
            )}
      </button>
    </>
  );
}