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
  if (!isPremium) {
    return (
      <div style={{ minWidth: 240, color: "#fff" }}>
        <Loc lat={lat} lng={lng} />

        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{t("kp.label", "Kp")}</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(data.kp)}</div>
        </div>

        <div style={{ fontSize: 13, color, marginTop: 2 }}>{levelLabel}</div>

        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: "rgba(255,255,255,0.05)",
            border: "1px dashed rgba(255,255,255,0.15)",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, opacity: 0.85 }}>🔒 — %</div>
          <Row label={t("row.clouds", "Clouds")} value={data.clouds != null ? `${data.clouds}%` : "–"} />
          <Row label={t("wind.speed", "Solar wind")} value="🔒" />
          <Row label={t("bz.label", "Bz")} value="🔒" />

          <a
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
            🔒 {t("forecast.unlock_full", "Unlock full forecast — from 2,99 €")}
          </a>
        </div>
      </div>
    );
  }

  // ---- PREMIUM
  return (
    <div style={{ minWidth: 240, color: "#fff" }}>
      <Loc lat={lat} lng={lng} />

      <div style={{ fontSize: 30, fontWeight: 700, color, marginTop: 6 }}>
        {data.probability != null ? `${data.probability}%` : "–"}
      </div>
      <div style={{ fontSize: 13, color }}>{levelLabel}</div>

      <div
        style={{
          marginTop: 6,
          height: 6,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${data.probability ?? 0}%`,
            height: "100%",
            background: color,
            transition: "width .3s ease",
          }}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 12 }}>
        <Row label={t("kp.label", "Kp")} value={fmt(data.kp)} />
        <Row
          label={`${t("row.clouds", "Clouds")}${data.cloudSource === "fmi" ? " (FMI)" : ""}`}
          value={data.clouds != null ? `${data.clouds}%` : "–"}
        />
        <Row label={t("wind.speed", "Solar wind")} value={fmt(data.speed, " km/s", 0)} />
        <Row label={t("bz.label", "Bz")} value={fmt(data.bz, " nT")} />
        <Row label={t("wind.density", "Density")} value={fmt(data.density, " p/cm³")} />
        {data.temp != null && <Row label={t("row.temp", "Temp")} value={`${data.temp}°C`} />}
        {data.windMs != null && (
          <Row label={t("weather.wind", "Wind")} value={`${data.windMs} m/s`} />
        )}
        {data.weatherDesc && (
          <div style={{ marginTop: 6, opacity: 0.7, fontStyle: "italic" }}>
            {data.weatherDesc}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function Loc({ lat, lng }) {
  return (
    <div style={{ fontSize: 12, opacity: 0.7 }}>
      📍 {lat.toFixed(2)}, {lng.toFixed(2)}
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <strong>{value}</strong>
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
