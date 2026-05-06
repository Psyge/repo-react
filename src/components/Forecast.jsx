import useTranslation from "../hooks/useTranslation";

export default function Forecast({ data }) {
  const { t } = useTranslation();

  // 🔥 groupataan slotit päivittäin (max probability)
  const grouped = {};

  (data || []).forEach((slot) => {
    const date = new Date(slot.tsUtc).toDateString();

    if (!grouped[date]) {
      grouped[date] = {
        kp: slot.kp,
        probability: slot.probability ?? null,
      };
    } else {
      // ota päivän paras arvo
      if ((slot.probability ?? 0) > (grouped[date].probability ?? 0)) {
        grouped[date].probability = slot.probability;
        grouped[date].kp = slot.kp;
      }
    }
  });

  const days = Object.values(grouped).slice(0, 3);

  return (
    <div className="forecast container">
      <h2>{t("forecast.title")}</h2>

      {/* EMPTY */}
      {days.length === 0 && (
        <div className="forecast-empty">
          {t("forecast.empty")}
        </div>
      )}

      {/* GRID */}
      <div className="forecast-grid">
        {days.map((day, i) => {
          const label =
            i === 0
              ? t("forecast.today")
              : i === 1
              ? t("forecast.tomorrow")
              : t("forecast.dayafter");

          const prob = day?.probability;
          const kp = day?.kp ?? "--";

          return (
            <div key={i} className="forecast-card">
              <div className="forecast-day">{label}</div>

              <div className="forecast-value">
                {prob != null ? `${prob}%` : `Kp ${kp}`}
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