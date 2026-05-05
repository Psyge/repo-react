import useTranslation from "../hooks/useTranslation";

export default function AuroraPopup({ lat, lng, prob, intensity }) {
  const getColor = () => {
    if (prob == null) return "#888";
    if (prob > 70) return "#ff3b7f";   // red
    if (prob > 40) return "#ffe600";   // yellow
    return "#00ffcc";                  // green
  };

  const color = getColor();
  const { t } = useTranslation();
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
        {prob == null ? "Loading..." : `${prob}%`}
      </div>

      {/* LABEL */}
      <div style={{ fontSize: "12px", opacity: 0.8 }}>
        <div>{t("probability.label")}</div>
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
        🌌 Strength: {intensity == null ? "..." : intensity}
      </div>
    </div>
  );
}