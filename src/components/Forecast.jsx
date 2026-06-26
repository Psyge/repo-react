import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const HOURS = ["18:00", "21:00", "00:00", "03:00"];

export default function Forecast({ data, tier: tierProp = "free", genAt, current }) {
  const { t } = useTranslation();
  const tier = tierProp;

  if (!data || data.length === 0) {
    return (
      <section className="forecast-modern">
        <div className="fc-empty">{t("forecast.empty")}</div>
      </section>
    );
  }

  // Vain ilta/yö
  const filtered = data.filter((slot) => {
    const hour = new Date(slot.tsUtc).getUTCHours();
    return hour >= 18 || hour <= 4;
  });

  // Ryhmittely päivän mukaan
  const grouped = {};
  filtered.forEach((slot) => {
    const d = new Date(slot.tsUtc);
    const dayKey = d.toISOString().slice(0, 10);
    if (!grouped[dayKey]) grouped[dayKey] = {};
    
    // TÄMÄ RIVI KORJATTU (ei enää ylimääräisiä kenoviivoja sotkemassa):
    const hour = `${d.getUTCHours()}`.padStart(2, "0") + ":00";

    grouped[dayKey][hour] = {
      kp: slot.kp,
      probability: slot.probability,
      clouds: slot.clouds,
    };
  });

  const sortedDays = Object.keys(grouped).sort();
  const days = sortedDays.map((k) => grouped[k]);

  const isPremium = tier === "premium";

  // Rakennetaan data kuvaajalle
  const chartData = HOURS.map((h) => {
    const item = { time: h };
    if (days[0]?.[h]) item.day1 = days[0][h].probability;
    if (days[1]?.[h]) item.day2 = days[1][h].probability;
    if (days[2]?.[h]) item.day3 = days[2][h].probability;
    return item;
  });

  // Kustomoitu, kaunis RepoTracker-tooltip kuvaajan sisälle
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="fc-custom-tooltip">
          <p className="fc-tooltip-time">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="fc-tooltip-row" style={{ color: entry.color }}>
              {entry.name}: <span>{entry.value}%</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <section className="forecast-modern">
      <div className="forecast-head">
        <h2>{t("forecast.title")}</h2>
        {isPremium ? (
          <span className="fc-badge fc-badge--premium">
            ★ Premium
          </span>
        ) : (
          <Link to="/premium" className="fc-badge fc-badge--unlock">
            🔒 {t("forecast.unlock")}
          </Link>
        )}
      </div>

      {isPremium && current && (
        <div className="fc-current-stats">
          <span>↑ {t("wind.speed")}: <strong>{current.speed != null ? `${Math.round(current.speed)} km/s` : "–"}</strong></span>
          <span className={current.bz < 0 ? "is-negative" : "is-positive"}>Bz: <strong>{current.bz != null ? current.bz.toFixed(1) : "–"}</strong></span>
          <span>{t("wind.density")}: <strong>{current.density != null ? current.density.toFixed(1) : "–"}</strong></span>
        </div>
      )}

      <div className="forecast-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            
            {/* Piilotetaan X-akselin tickit, koska alla oleva Kp-palkki toimii dynaamisena akselina */}
            <XAxis dataKey="time" tick={false} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke="#4b5563" tickLine={false} axisLine={false} className="fc-yaxis-labels" />

            <Tooltip content={<CustomTooltip />} />
            
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={8}
            />

            {/* Tänä iltana */}
            <Line
              type="monotone"
              dataKey="day1"
              stroke="#2EF2D0"
              strokeWidth={3}
              connectNulls
              name={t("forecast.tonight") || "Tänä iltana"}
              dot={{ r: 4, stroke: "#0b131a", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />

            {/* Huomenna */}
            <Line
              type="monotone"
              dataKey="day2"
              stroke="#60a5fa"
              strokeWidth={isPremium ? 3 : 1.5}
              strokeDasharray={isPremium ? "0" : "4 4"}
              strokeOpacity={isPremium ? 1 : 0.4}
              connectNulls
              name={t("forecast.tomorrow") || "Huomenna"}
              dot={isPremium ? { r: 4, stroke: "#0b131a", strokeWidth: 2 } : false}
            />

            {/* Ylihuomenna */}
            <Line
              type="monotone"
              dataKey="day3"
              stroke="#f59e0b"
              strokeWidth={isPremium ? 3 : 1.5}
              strokeDasharray={isPremium ? "0" : "4 4"}
              strokeOpacity={isPremium ? 1 : 0.4}
              connectNulls
              name={t("forecast.dayafter") || "Ylihuomenna"}
              dot={isPremium ? { r: 4, stroke: "#0b131a", strokeWidth: 2 } : false}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Free-lukituslasikerros modernilla sumennuksella */}
        {!isPremium && (
          <Link to="/premium" className="fc-lock-overlay">
            <span className="fc-overlay-btn">
              🔒 {t("forecast.unlock") || "Avaa 3 päivän ennuste"}
            </span>
          </Link>
        )}
      </div>

      {/* Siisti, jaettu Kp- ja säärivi pohjalle */}
      <div className="fc-kp-grid-row">
        {HOURS.map((h, idx) => {
          const slot = days[0]?.[h];
          return (
            <div key={h} className="fc-kp-grid-col">
              <div className="fc-col-time">{h}</div>
              <div className="fc-col-kp">Kp {slot?.kp ?? "–"}</div>
              {isPremium && (
                <div className="fc-col-clouds">
                  ☁ {slot?.clouds != null ? `${slot.clouds}%` : "–"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isPremium && (
        <p className="fc-free-hint-text">
          {t("forecast.free_hint")}
        </p>
      )}
    </section>
  );
}