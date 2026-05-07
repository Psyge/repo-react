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

  // 🌙 vain ilta/yö
  const filtered = data.filter((slot) => {
    const hour = new Date(slot.tsUtc).getUTCHours();

    return hour >= 18 || hour <= 4;
  });

  // 📅 groupataan päivittäin
  const grouped = {};

  filtered.forEach((slot) => {
    const d = new Date(slot.tsUtc);

    const dayKey = d.toDateString();

    if (!grouped[dayKey]) {
      grouped[dayKey] = [];
    }

    grouped[dayKey].push({
      time: `${d
        .getUTCHours()
        .toString()
        .padStart(2, "0")}:00`,

      aurora: Number(slot.probability ?? 0),

      clouds: Number(slot.clouds ?? 0),

      kp: Number(slot.kp ?? 0),
    });
  });

  // vain 3 päivää
  const days = Object.entries(grouped).slice(0, 3);

  return (
    <section className="forecast-modern">
      <div className="forecast-head">
        <h2>{t("forecast.title")}</h2>
      </div>

      <div className="forecast-days">
        {days.map(([dayKey, chartData], i) => {
          const label =
            i === 0
              ? t("forecast.today")
              : i === 1
              ? t("forecast.tomorrow")
              : t("forecast.dayafter");

          return (
            <div
              key={dayKey}
              className="forecast-day-card"
            >
              <div className="forecast-day-head">
                {label}
              </div>

              <div className="forecast-chart">
                <ResponsiveContainer
                  width="100%"
                  height={260}
                >
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
                        border:
                          "1px solid rgba(255,255,255,0.08)",
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
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}