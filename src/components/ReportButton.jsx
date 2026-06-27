import { useState } from "react";
import useTranslation from "../hooks/useTranslation";
import SpinModal from "../components/Spinmodal";

const BASE = import.meta.env.VITE_API_BASE || "";

const TURNSTILE_SITE_KEY = "0x4AAAAAADF29-_iSqwRQWf2";

export default function ReportButton() {
  const { t } = useTranslation();
  const [loading,      setLoading]      = useState(false);
  const [showSpin,     setShowSpin]     = useState(false);
  const [spinId,       setSpinId]       = useState(null);
  const [spinPrize,    setSpinPrize]    = useState(null);   // null = ei voittoa
  const [spinResults,  setSpinResults]  = useState(null);   // ['no_win','no_win', id]
  const [alreadySpun,  setAlreadySpun]  = useState(false);
  const [spinLoading,  setSpinLoading]  = useState(false);

  const getTurnstileToken = async () => {
    return new Promise((resolve, reject) => {
      let widgetId = null;
      const cleanup = () => {
        if (widgetId != null && window.turnstile) {
          try { window.turnstile.remove(widgetId); } catch { /* ignore */ }
        }
      };
      try {
        if (!window.turnstile) { reject(new Error("Turnstile not loaded")); return; }
        const container = document.getElementById("turnstile-container");
        if (!container) { reject(new Error("Turnstile container missing")); return; }
        container.innerHTML = "";
        widgetId = window.turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          size: "invisible",
          callback: (token) => { resolve(token); setTimeout(cleanup, 0); },
          "error-callback":   () => { cleanup(); reject(new Error("Turnstile failed")); },
          "expired-callback": () => { cleanup(); reject(new Error("Turnstile expired")); },
        });
        setTimeout(() => {
          try { window.turnstile.execute(widgetId); }
          catch (err) { cleanup(); reject(err); }
        }, 50);
      } catch (err) { cleanup(); reject(err); }
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
          const turnstileToken = await getTurnstileToken();
          const payload = {
            lat:     Number(pos.coords.latitude),
            lon:     Number(pos.coords.longitude),
            createdAt: Date.now(),
            source:  "web",
            turnstileToken,
          };

          const res  = await fetch(`${BASE}/api/sightings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.status === 429) { alert(t("sightings.cooldown")); return; }

          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || "Request failed");

          if (window.__refreshSightings) window.__refreshSightings();

          // Onnenpyörä vain jos raportti päätyi kartalle (pimeää).
          // Valoisaan aikaan: kiitos, mutta ei pyörää (säästää workeria).
          if (data.counted) {
            setSpinId(null);
            setSpinPrize(null);
            setSpinResults(null);
            setAlreadySpun(false);
            setShowSpin(true);
          } else {
            alert(t("sightings.thanks_daylight") || t("sightings.thanks") ||
              "Thanks! It's too bright for auroras right now, so this report isn't shown on the map.");
          }
        } catch (err) {
          console.error("REPORT ERROR:", err);
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  // Käyttäjä päättää pelata → /api/sightings/spin
  const handleSpin = async () => {
    if (spinLoading) return;
    setSpinLoading(true);
    try {
      const turnstileToken = await getTurnstileToken();
      const res = await fetch(`${BASE}/api/sightings/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken }),
      });
      const data = await res.json();

      if (data.alreadySpun) { setAlreadySpun(true); return; }
      if (!res.ok) { alert(data.message || "Spin failed"); return; }

      setSpinPrize(data.prize);       // null = ei voittoa
      setSpinResults(data.results);   // ['no_win','no_win', id]
      setSpinId(data.spinId);         // viimeisenä → laukaisee animaation SpinModalissa
    } catch (err) {
      console.error("SPIN ERROR:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSpinLoading(false);
    }
  };

  return (
    <>
      <div id="turnstile-container" style={{ display: "none" }} />

      <button onClick={report} className="btn-primary" disabled={loading}>
        {loading ? (t("common.loading") || "Loading...") : t("sightings.report_btn")}
      </button>

      {showSpin && (
        <SpinModal
          spinId={spinId}
          prize={spinPrize}
          results={spinResults}
          alreadySpun={alreadySpun}
          spinLoading={spinLoading}
          onSpin={handleSpin}
          onClose={() => setShowSpin(false)}
        />
      )}
    </>
  );
}