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
      <section className="forecast-modern">
        <div className="fc-empty">
          {t("forecast.empty")}
        </div>
      </section>
    );
  }

  // 🌙 näytetään vain ilta/yö jolloin revontulia voi oikeasti nähdä
  const filtered = data.filter((slot) => {
    const hour = new Date(slot.tsUtc).getUTCHours();

    return hour >= 18 || hour <= 4;
  });

  // 📊 chart data
  const chartData = filtered.slice(0, 8).map((slot) => {
    const d = new Date(slot.tsUtc);

    return {
      time: `${d
        .getUTCHours()
        .toString()
        .padStart(2, "0")}:00`,

      // backend probability %
      aurora: Number(slot.probability ?? 0),

      // pilvisyys %
      clouds: Number(slot.clouds ?? 0),

      // debug
      kp: Number(slot.kp ?? 0),
    };
  });

  console.log("FORECAST DATA:", chartData);

  return (
    <section className="forecast-modern">
      <div className="forecast-head">
        <h2>{t("forecast.title")}</h2>
      </div>

      <div className="forecast-chart">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart
            data={chartData}
            margin={{
              top: 20,
              right: 20,
              left: 0,
              bottom: 10,
            }}
          >
            <CartesianGrid
              stroke="rgba(255,255,255,0.08)"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              tickLine={false}
              axisLine={false}
            />

            <YAxis
              domain={[0, 100]}
              stroke="#9ca3af"
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                color: "#fff",
              }}
            />

            <Legend />

            {/* 🌌 Aurora probability */}
            <Line
              type="monotone"
              dataKey="aurora"
              stroke="#2EF2D0"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
              name="Aurora %"
            />

            {/* ☁ Pilvisyys */}
            <Line
              type="monotone"
              dataKey="clouds"
              stroke="#a855f7"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
              name="Clouds %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}