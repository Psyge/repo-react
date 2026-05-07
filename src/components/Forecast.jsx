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

export default function Forecast({ data }) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="forecast-modern">
        <div className="fc-empty">
          {t("forecast.empty")}
        </div>
      </div>
    );
  }

  // 🔥 vain ilta/yö tunnit
  const filtered = data.filter((slot) => {
    const hour = new Date(slot.tsUtc).getUTCHours();

    return hour >= 18 || hour <= 4;
  });

  // 🔥 chart data
  const chartData = filtered.slice(0, 8).map((slot) => {
    const d = new Date(slot.tsUtc);

    return {
      time: `${d.getUTCHours()
        .toString()
        .padStart(2, "0")}:00`,

      // 🔥 käytetään probabilitya eikä kp:tä
      aurora: Number(slot.probability ?? 0),

      clouds: Number(slot.clouds ?? 0),
    };
  });
console.log(data);
  return (
    <section className="forecast-modern">
      <div className="forecast-head">
        <h2>{t("forecast.title")}</h2>
      </div>

      <div className="forecast-chart">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />

            <XAxis
              dataKey="time"
              stroke="#9ca3af"
            />

            <YAxis
              domain={[0, 100]}
              stroke="#9ca3af"
            />

            <Tooltip />

            <Legend />

            {/* 🔥 Aurora probability */}
            <Line
              type="monotone"
              dataKey="aurora"
              stroke="#2EF2D0"
              strokeWidth={3}
              dot={{ r: 4 }}
              name="Aurora %"
            />

            {/* ☁ Clouds */}
            <Line
  type="monotone"
  dataKey="clouds"
  stroke="#a855f7"
  strokeWidth={3}
  dot={{ r: 3 }}
  name="Clouds %"
/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}