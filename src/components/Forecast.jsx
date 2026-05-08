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
  const chartData = filtered.map((slot) => {
    const d = new Date(slot.tsUtc);

    const day = d.toLocaleDateString("fi-FI", {
      weekday: "short",
    });

    return {
      fullTime: d.toISOString(),

      time: `${d
        .getUTCHours()
        .toString()
        .padStart(2, "0")}:00`,

      label: `${day} ${d
        .getUTCHours()
        .toString()
        .padStart(2, "0")}`,

 aurora:
  slot.probability ??
  freeAuroraScore(
    slot.kp ?? 0,
    d.getUTCHours()
  ),

      clouds:
  slot.clouds != null
    ? Number(slot.clouds)
    : null,

      kp: Number(slot.kp ?? 0),
    };
  });

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
              dataKey="label"
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
              dataKey="aurora"
              stroke="#2EF2D0"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
              name="Aurora %"
            />

            {/* ☁ Clouds */}
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

            {/* päivän erotusviivat */}
            <ReferenceLine
              x={chartData[8]?.label}
              stroke="rgba(255,255,255,0.15)"
            />

            <ReferenceLine
              x={chartData[16]?.label}
              stroke="rgba(255,255,255,0.15)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}