import { useEffect, useState } from "react";
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
    const hour = `${d.getUTCHours()}`.padStart(2, "0") + ":00";

    // Premium käyttää workerin todellista probabilityä (sis. OVATION+pilvet),
    // free fallbackaa yksinkertaiseen Kp-skooriin.
    const prob =
  tier === "premium" && slot.probability != null
    ? slot.probability
    : Math.round(((slot.kp ?? 0) / 9) * 100);

    grouped[dayKey][hour] = {
      prob,
      kp: slot.kp ?? null,
      clouds: slot.clouds ?? null,
    };
  });

  const days = Object.values(grouped);

  const chartData = HOURS.map((hour) => ({
    time: hour,
    day1: days[0]?.[hour]?.prob ?? null,
    day2: days[1]?.[hour]?.prob ?? null,
    day3: days[2]?.[hour]?.prob ?? null,
    kp1: days[0]?.[hour]?.kp ?? null,
    cloud1: days[0]?.[hour]?.clouds ?? null,
  }));

  const isPremium = tier === "premium";

  return (
    <section className="forecast-modern">
      <div className="forecast-head" >
        <h2>{t("forecast.title")}</h2>
        {isPremium ? (
  <span className="fc-badge fc-badge--premium">
    ★ Premium
  </span>
) : (
  <Link to="/premium" className="fc-badge">
    🔒 {t("forecast.unlock")}
  </Link>
)}
      </div>
  {isPremium && current && (
  <div className="fc-current">
    <span>↑ {t("wind.speed")}: <strong>{current.speed != null ? `${Math.round(current.speed)} km/s` : "–"}</strong></span>
    <span>Bz: <strong>{current.bz != null ? current.bz.toFixed(1) : "–"}</strong></span>
    <span>{t("wind.density")}: <strong>{current.density != null ? current.density.toFixed(1) : "–"}</strong></span>
  </div>
)}
      <div className="forecast-chart" style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="time" stroke="#9ca3af" tickLine={false} axisLine={false} interval={1} />
            <YAxis domain={[0, 100]} stroke="#9ca3af" tickLine={false} axisLine={false} />

            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                color: "#fff",
              }}
              formatter={(value, name) => {
                if (value == null) return ["–", name];
                return [`${value}%`, name];
              }}
            />
            <Legend
  verticalAlign="bottom"
  align="center"
  wrapperStyle={{
    paddingTop: 16,
    bottom: -6,
  }}
/>

            {/* Tonight — aina näkyvissä */}
            <Line
              type="monotone"
              dataKey="day1"
              stroke="#2EF2D0"
              strokeWidth={3}
              connectNulls
              name={t("forecast.tonight")}
              dot={{ r: 4 }}
            />

            {/* Tomorrow & Day 3 — premium vain (free saa katkoviivan teaseriksi) */}
            <Line
              type="monotone"
              dataKey="day2"
              stroke="#60a5fa"
              strokeWidth={isPremium ? 3 : 1.5}
              strokeDasharray={isPremium ? "0" : "6 6"}
              strokeOpacity={isPremium ? 1 : 0.35}
              connectNulls
              name={t("forecast.tomorrow")}
              dot={isPremium}
            />
            <Line
              type="monotone"
              dataKey="day3"
              stroke="#f59e0b"
              strokeWidth={isPremium ? 3 : 1.5}
              strokeDasharray={isPremium ? "0" : "6 6"}
              strokeOpacity={isPremium ? 1 : 0.35}
              connectNulls
              name={t("forecast.dayafter")}
              dot={isPremium}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Free-overlay: päivien 2–3 päälle blur + CTA */}
        {!isPremium && (
          <div
            className="fc-lock-overlay"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: "66%",
              height: "100%",
              pointerEvents: "none",
              background:
                "linear-gradient(90deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.65) 35%, rgba(15,23,42,0.85) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Link
              to="/premium"
              style={{
                pointerEvents: "auto",
                background: "linear-gradient(135deg,#2EF2D0,#60a5fa)",
                color: "#0f172a",
                padding: "10px 18px",
                borderRadius: 999,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 8px 24px rgba(46,242,208,0.25)",
              }}
            >
              🔒 {t("forecast.unlock_full") || "Unlock 3-day forecast"}
            </Link>
          </div>
        )}
      </div>

      {/* Kp-rivi pohjalle (free + premium) */}
      <div
        className="fc-kp-row"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${HOURS.length}, 1fr)`,
          marginTop: 12,
          gap: 8,
          color: "#9ca3af",
          fontSize: 13,
          textAlign: "center",
        }}
      >
        {HOURS.map((h) => {
          const slot = days[0]?.[h];
          return (
            <div key={h}>
              <div style={{ opacity: 0.6 }}>{h}</div>
              <div style={{ color: "#fff", fontWeight: 600 }}>
                Kp {slot?.kp ?? "–"}
              </div>
              {isPremium && (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  ☁ {slot?.clouds != null ? `${slot.clouds}%` : "–"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isPremium && (
        <p style={{ marginTop: 16, fontSize: 13, color: "#9ca3af", textAlign: "center" }}>
          {t("forecast.free_hint") ||
            "Free view shows tonight's Kp-based estimate. Premium adds OVATION + cloud cover for 3 days."}
        </p>
      )}
    </section>
  );
}
