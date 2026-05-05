import useTranslation from "../hooks/useTranslation";

export default function AuroraPopup({ lat, lng, prob, intensity }) {
  const { t } = useTranslation();

  const getColor = () => {
    if (prob == null) return "#888";
    if (prob > 70) return "#ff3b7f";
    if (prob > 40) return "#ffe600";
    return "#00ffcc";
  };

  const color = getColor();

  return (
    <div style={{ minWidth: "200px", color: "#fff" }}>
      {/* LOCATION */}
      <div style={{ fontSize: "12px", opacity: 0.7 }}>
        📍 {lat.toFixed(2)}, {lng.toFixed(2)}
      </div>

      {/* MAIN VALUE */}
      <div
        style={{
          fontSize: "30px",
          fontWeight: "700",
          color: color,
          marginTop: "6px",
        }}
      >
        {prob == null ? t("loading") : `${prob}%`}
      </div>

      {/* LABEL */}
      <div style={{ fontSize: "12px", opacity: 0.8 }}>
        {t("probability.label")}
      </div>

      {/* PROGRESS BAR */}
      <div
        style={{
          marginTop: "6px",
          height: "6px",
          background: "rgba(255,255,255,0.1)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${prob ?? 0}%`,
            height: "100%",
            background: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* EXTRA DATA */}
      <div
        style={{
          marginTop: "8px",
          fontSize: "12px",
          opacity: 0.7,
        }}
      >
        🌌 {t("map.strength")}: {intensity == null ? "..." : intensity}
      </div>
    </div>
  );
}