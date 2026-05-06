import useTranslation from "../hooks/useTranslation";

export default function Forecast({ data }) {
  const { t } = useTranslation();

  // fallback jos data puuttuu
  const days = data && data.length ? data.slice(0, 3) : [];

  return (
    <div className="forecast container">
      <h2>{t("forecast.title")}</h2>

      {/* 🔥 EMPTY */}
      {days.length === 0 && (
        <div className="forecast-empty">
          {t("forecast.empty")}
        </div>
      )}

      {/* 🔥 GRID */}
      <div className="forecast-grid">
        {days.map((day, i) => {
          const label =
            i === 0
              ? t("forecast.today")
              : i === 1
              ? t("forecast.tomorrow")
              : t("forecast.dayafter");

          const prob = day?.probability ?? "--";
          const kp = day?.kp ?? "--";

          return (
            <div key={i} className="forecast-card">
              <div className="forecast-day">{label}</div>

              <div className="forecast-value">
                {prob !== "--" ? `${prob}%` : "--"}
              </div>

              <div className="forecast-meta">
                Kp: <strong>{kp}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}