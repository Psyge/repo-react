import useTranslation from "../hooks/useTranslation";

export default function Forecast({ data }) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="fc-wrap">
        <div className="fc-empty">{t("forecast.empty")}</div>
      </div>
    );
  }

  // 🔥 groupataan päivittäin
  const grouped = {};

  data.forEach((slot) => {
    const d = new Date(slot.tsUtc);
    const dayKey = d.toDateString();

    if (!grouped[dayKey]) grouped[dayKey] = [];
    grouped[dayKey].push({ ...slot, date: d });
  });

  const days = Object.entries(grouped).slice(0, 3);

  return (
    <div className="fc-wrap">
      <div className="fc-head">
        <h3>{t("forecast.title")}</h3>
        <div className="fc-tz">UTC</div>
      </div>

      <div className="fc-days">
        {days.map(([dayKey, slots], i) => {
          const label =
            i === 0
              ? t("forecast.today")
              : i === 1
              ? t("forecast.tomorrow")
              : t("forecast.dayafter");

          return (
            <div key={dayKey}>
              <div className="fc-day-head">{label}</div>

              <div className="fc-row">
                {slots.map((s, idx) => {
                  const hour = s.date.getUTCHours();

                  // 🌙 night highlight (simple)
                  const isNight = hour >= 20 || hour <= 5;

                  return (
                    <div
                      key={idx}
                      className={`fc-slot ${isNight ? "fc-night" : ""}`}
                    >
                      <div className="fc-time">
                        {hour.toString().padStart(2, "0")}:00
                      </div>

                      <div className="fc-prob">
                        {s.probability != null
  ? `${Math.round(s.probability)}%`
  : `Kp ${s.kp ?? "--"}`}
                      </div>

                      <div className="fc-kp">Kp {s.kp}</div>

                      {s.clouds != null && (
                        <div className="fc-cloud">
                          ☁ {s.clouds}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}