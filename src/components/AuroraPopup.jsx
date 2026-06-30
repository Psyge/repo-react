import { useState } from "react";
import useTranslation from "../hooks/useTranslation";

export default function AuroraPopup({
  lat,
  lng,
  data,
  error,
  premium = false,
  loading = false,
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("now");

  if (!data && !error) {
    return (
      <div style={{ minWidth: 220, color: "#fff" }}>
        <Loc lat={lat} lng={lng} />
        <div style={{ marginTop: 8, opacity: 0.7 }}>{t("loading", "Loading…")}</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ minWidth: 220, color: "#fff" }}>
        <Loc lat={lat} lng={lng} />
        <div style={{ marginTop: 8, color: "#ff6b6b" }}>{t("error.fetch", "Failed to load data")}</div>
      </div>
    );
  }

  const isPremium = data?.tier === "premium";
  const currentSlot = isPremium ? (data?.slots?.[0] ?? null) : null;
  const kp = isPremium ? (currentSlot?.kp ?? null) : (data?.kp ?? null);
  const probability = isPremium ? (currentSlot?.probability ?? null) : null;
  const clouds = isPremium ? (currentSlot?.clouds ?? null) : (data?.clouds ?? null);
  const bz = data?.current?.bz ?? null;
  const speed = data?.current?.speed ?? null;
  const density = data?.current?.density ?? null;
  const level = isPremium
    ? (currentSlot?.level ?? probabilityToLevel(probability))
    : (data?.level ?? probabilityToLevel(null));
  const color = levelColor(level);
  const levelLabel = t(`probability.${level}`, level);

  // --- FREE ---
  if (!isPremium) {
    return (
      <div style={{ minWidth: 240, color: "#fff" }}>
        <Loc lat={lat} lng={lng} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{t("kp.label", "Kp")}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color }}>
            {data?.kp != null ? fmt(data.kp) : "–"}
          </div>
        </div>
        <div style={{ fontSize: 13, color, marginTop: 2 }}>{levelLabel}</div>
        {clouds != null && (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {t("row.clouds", "Clouds")}: <strong>{clouds}%</strong>
          </div>
        )}
        {loading && (
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>{t("loading", "Loading…")}</div>
        )}
        
         <a href="/premium"
          style={{
            display: "block",
            marginTop: 12,
            padding: "9px 10px",
            textAlign: "center",
            background: "linear-gradient(135deg,#ff3b7f,#ffe600)",
            color: "#000",
            fontWeight: 700,
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          {t("forecast.popup_full", "Unlock full forecast — from 2,99 €")}
        </a>
      </div>
    );
  }

  // --- PREMIUM ---
  const bestWindow = data?.bestWindow ?? null;
  const slots = (data?.slots ?? []).slice(0, 8);

  return (
    <div className="aurora-popup aurora-popup--premium">
      <Loc lat={lat} lng={lng} />

      {/* Välilehdet */}
      <div className="ap-tabs">
        <button
          className={`ap-tab ${tab === "now" ? "ap-tab--active" : ""}`}
          onClick={() => setTab("now")}
        >
          {t("tab.now", "Now")}
        </button>
        <button
          className={`ap-tab ${tab === "forecast" ? "ap-tab--active" : ""}`}
          onClick={() => setTab("forecast")}
        >
          {t("tab.forecast", "Forecast")}
        </button>
      </div>

      {tab === "now" && (
  <>
    {/* Iso tila-teksti, dynaaminen prosentti */}
    <div className="ap-status">
      <div className="ap-status-level" style={{ color }}>
        {levelLabel}
      </div>
      <div className="ap-status-prob" style={{ color }}>
        {probability != null ? `${probability}%` : "–"}
      </div>
    </div>

          {/* Paras ikkuna */}
          {bestWindow && (
            <div className="ap-window">
              ⏰ {t("window.best", "Best window")}{" "}
              {formatLocalHour(bestWindow.start)}–{formatLocalHour(bestWindow.end)}
              {bestWindow.peakKp != null && (
                <span style={{ opacity: 0.7 }}> · Kp {bestWindow.peakKp}</span>
              )}
            </div>
          )}

          {/* Quick stats */}
          <div className="ap-quick">
            <div>
              <span>{t("kp.label", "Kp")}</span>
              <strong>{fmt(kp)}</strong>
            </div>
            <div>
              <span>{t("row.clouds", "Clouds")}</span>
              <strong>{clouds != null ? `${clouds}%` : "–"}</strong>
            </div>
            <div>
              <span>{t("bz.label", "Bz")}</span>
              <strong>{fmt(bz)}</strong>
            </div>
          </div>

          {/* Solar wind */}
          <div className="ap-details">
            <div>
              <span>{t("wind.speed", "Solar wind")}</span>
              <strong>{fmt(speed, " km/s", 0)}</strong>
            </div>
            <div>
              <span>{t("wind.density", "Density")}</span>
              <strong>{fmt(density, " p/cm³")}</strong>
            </div>
          </div>
        </>
      )}

      {tab === "forecast" && (
        <div className="ap-forecast">
          {slots.length > 0 ? slots.map((s) => (
            <ForecastRow key={s.tsUtc} slot={s} />
          )) : (
            <div style={{ opacity: 0.5, fontSize: 12, marginTop: 8 }}>
              {t("forecast.nodata", "No forecast data")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ForecastRow({ slot }) {
  const prob = slot.probability ?? 0;
  const color = levelColor(slot.level ?? "low");
  const hour = formatLocalHour(slot.tsUtc);

  return (
    <div className="ap-frow">
      <div className="ap-frow-time">{hour}</div>
      <div className="ap-frow-bar-bg">
        <div className="ap-frow-bar" style={{ width: `${prob}%`, background: color + "66" }} />
      </div>
      <div className="ap-frow-pct" style={{ color }}>{prob}%</div>
    </div>
  );
}

function Loc({ lat, lng }) {
  return (
    <div className="ap-name">
      📍 {lat.toFixed(2)}, {lng.toFixed(2)}
    </div>
  );
}

function fmt(v, suffix = "", digits = 1) {
  if (v == null || isNaN(v)) return "–";
  return Number(v).toFixed(digits) + suffix;
}

function formatLocalHour(isoString) {
  if (!isoString) return "–";
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function probabilityToLevel(probability) {
  if (probability == null || isNaN(probability)) return "low";
  if (probability >= 75) return "veryhigh";
  if (probability >= 50) return "high";
  if (probability >= 25) return "medium";
  return "low";
}

function levelColor(level) {
  return { low: "#888", medium: "#ffe600", high: "#00ff88", veryhigh: "#ff3b7f" }[level] || "#888";
}