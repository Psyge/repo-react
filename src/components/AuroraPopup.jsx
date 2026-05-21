import useTranslation from "../hooks/useTranslation";

/**
 * AuroraPopup
 * Props:
 *   lat, lng        – sijainti
 *   data            – workerin /api/aurora/calc vastaus tai null (loading)
 *                     { tier:'free'|'premium', kp, level, clouds, probability,
 *                       speed, bz, density, temp, windMs, weatherDesc, cloudSource }
 *   error           – true jos fetch epäonnistui
 */
export default function AuroraPopup({ lat, lng, data, error }) {
  const { t } = useTranslation();

  // ---- Loading
  if (!data && !error) {
    return (
      <div style={{ minWidth: 220, color: "#fff" }}>
        <Loc lat={lat} lng={lng} />
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          {t("loading", "Loading…")}
        </div>
      </div>
    );
  }

  // ---- Error
  if (error || !data) {
    return (
      <div style={{ minWidth: 220, color: "#fff" }}>
        <Loc lat={lat} lng={lng} />
        <div style={{ marginTop: 8, color: "#ff6b6b" }}>
          {t("error.fetch", "Failed to load data")}
        </div>
      </div>
    );
  }

  const isPremium = data.tier === "premium";
  const level = data.level || "low";
  const color = levelColor(level);
  const levelLabel = t(`probability.${level}`, level);

  // ---- FREE: vain Kp + level + locked teaser
 // ---- FREE: vain Kp + level + locked teaser
if (!isPremium) {
  return (
    <div style={{ minWidth: 240, color: "#fff" }}>
      <Loc lat={lat} lng={lng} />

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{t("kp.label", "Kp")}</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(data.kp)}</div>
      </div>

      <div style={{ fontSize: 13, color, marginTop: 2 }}>{levelLabel}</div>

      {/* Pilvisyys näytetään ilmaiseksi — konkreettinen arvo houkuttelee */}
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        {t("row.clouds", "Clouds")}: <strong>{data.clouds != null ? `${data.clouds}%` : "–"}</strong>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: 10,
          background: "rgba(255,255,255,0.05)",
          border: "1px dashed rgba(255,255,255,0.15)",
          borderRadius: 8,
        }}
      >
        {/* Näytetään mitä premium sisältää — ei pelkkä lukko */}
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
          {t("popup.premiumIncludes", "Premium unlocks:")}
        </div>

        <Row
          label={t("probability.label", "Aurora probability")}
          value={<span style={{ color: "#00ffcc" }}>— %</span>}
          locked
        />
        <Row
          label={t("wind.speed", "Solar wind")}
          value="—"
          locked
        />
        <Row
          label={t("bz.label", "Bz")}
          value="—"
          locked
        />
        <Row
          label={t("wind.density", "Density")}
          value="—"
          locked
        />

        
          href="/premium"
          style={{
            display: "block",
            marginTop: 10,
            padding: "8px 10px",
            textAlign: "center",
            background: "linear-gradient(135deg,#ff3b7f,#ffe600)",
            color: "#000",
            fontWeight: 700,
            borderRadius: 6,
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          🔒 {t("forecast.popup_full", "Unlock full forecast — from 2,99 €")}
        </a>
      </div>
    </div>
  );
}

  // ---- PREMIUM
return (
  <div className="aurora-popup">
    <Loc lat={lat} lng={lng} />

    <div
      className="ap-prob"
      style={{ color }}
    >
      {data.probability != null
        ? `${data.probability}%`
        : "–"}
    </div>

    <div
      className="ap-level"
      style={{ color }}
    >
      {levelLabel}
    </div>

    <div className="ap-quick">
      <div>
        <span>{t("kp.label", "Kp")}</span>
        <strong>{fmt(data.kp)}</strong>
      </div>

      <div>
        <span>{t("row.clouds", "Clouds")}</span>
        <strong>
          {data.clouds != null
            ? `${data.clouds}%`
            : "–"}
        </strong>
      </div>

      <div>
        <span>{t("bz.label", "Bz")}</span>
        <strong>{fmt(data.bz)}</strong>
      </div>
    </div>

    <div className="ap-details">
      <div>
        <span>{t("wind.speed", "Solar wind")}</span>
        <strong>{fmt(data.speed, " km/s", 0)}</strong>
      </div>

      <div>
        <span>{t("wind.density", "Density")}</span>
        <strong>{fmt(data.density, " p/cm³")}</strong>
      </div>

      {data.temp != null && (
        <div>
          <span>{t("row.temp", "Temp")}</span>
          <strong>{data.temp}°C</strong>
        </div>
      )}

      {data.windMs != null && (
        <div>
          <span>{t("weather.wind", "Wind")}</span>
          <strong>{data.windMs} m/s</strong>
        </div>
      )}
    </div>

    {data.weatherDesc && (
      <div className="ap-desc">
        {data.weatherDesc}
      </div>
    )}
  </div>
  );
}

/* ---------- helpers ---------- */
function Loc({ lat, lng }) {
  return (
    <div className="ap-name">
      📍 {lat.toFixed(2)}, {lng.toFixed(2)}
    </div>
  );
}
function Row({ label, value, locked = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <strong style={{ opacity: locked ? 0.5 : 1 }}>
        {locked ? "🔒" : value}
      </strong>
    </div>
  );
}
function fmt(v, suffix = "", digits = 1) {
  if (v == null || isNaN(v)) return "–";
  return Number(v).toFixed(digits) + suffix;
}
function levelColor(level) {
  return (
    {
      low: "#888",
      medium: "#ffe600",
      high: "#00ff88",
      veryhigh: "#ff3b7f",
    }[level] || "#888"
  );
  }

