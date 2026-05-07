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

  // 🔥 vain seuraavat 24h näkyviin
  const chartData = data.slice(0, 8).map((slot) => {
    const d = new Date(slot.tsUtc);

    return {
      time: `${d.getUTCHours()
        .toString()
        .padStart(2, "0")}:00`,

      kp: Number(slot.kp ?? 0),

      clouds: Number(slot.clouds ?? 0),

      probability: Number(slot.probability ?? 0),
    };
  });

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
              domain={[0, 9]}
              stroke="#9ca3af"
            />

            <Tooltip />

            <Legend />

            <Line
              type="monotone"
              dataKey="kp"
              stroke="#2EF2D0"
              strokeWidth={3}
              dot={{ r: 4 }}
              name="Kp"
            />

            <Line
              type="monotone"
              dataKey="clouds"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={false}
              name="Clouds %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}