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
  ReferenceLine,
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
function freeAuroraScore(kp, hour) {
  let score = (kp / 9) * 100;

  // yöbonus
  if (hour >= 22 || hour <= 1) {
    score += 10;
  }

  // aamuyö heikompi
  if (hour >= 3 && hour <= 5) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
  // 🌙 vain ilta/yö
  const filtered = data.filter((slot) => {
    const hour = new Date(slot.tsUtc).getUTCHours();

    return hour >= 18 || hour <= 4;
  });

  // 📊 koko 3 päivän data samaan charttiin
const grouped = {};

filtered.forEach((slot) => {
  const d = new Date(slot.tsUtc);

  const dayKey = d.toISOString().slice(0, 10);

  if (!grouped[dayKey]) {
    grouped[dayKey] = {};
  }

  const hour = `${d.getUTCHours()}`
    .padStart(2, "0") + ":00";

  grouped[dayKey][hour] =
    slot.probability ??
    freeAuroraScore(
      slot.kp ?? 0,
      d.getUTCHours()
    );
});

const hours = [
  "18:00",
  "21:00",
  "00:00",
  "03:00",
];

const chartData = hours.map((hour) => ({
  time: hour,
  day1: Object.values(grouped)[0]?.[hour] ?? null,
  day2: Object.values(grouped)[1]?.[hour] ?? null,
  day3: Object.values(grouped)[2]?.[hour] ?? null,
}));

  return (
    <section className="forecast-modern">
      <div className="forecast-head">
        <h2>{t("forecast.title")}</h2>
      </div>

      <div className="forecast-chart">
        <ResponsiveContainer width="100%" height={340}>
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
              interval={1}
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

            {/* 🌌 Aurora */}
          <Line
  type="monotone"
  dataKey="day1"
  stroke="#2EF2D0"
  strokeWidth={3}
  connectNulls
  name="Tonight"
/>

<Line
  type="monotone"
  dataKey="day2"
  stroke="#60a5fa"
  strokeWidth={3}
  connectNulls
  name="Tomorrow"
/>

<Line
  type="monotone"
  dataKey="day3"
  stroke="#f59e0b"
  strokeWidth={3}
  connectNulls
  name="Day 3"
/>

          
            
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}