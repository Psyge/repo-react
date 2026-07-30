/* ========================================================================
   HeroForecast — Kp-ennustegraafi heron alaosassa.

   Puhdas esityskomponentti: kaikki data ja laskenta tulevat propseina
   AuroraHerolta (wave rakennetaan siellä buildWave-funktiolla).

   HUOM: mittasuhteet (WAVE_W/H/PAD) tulevat propseina, koska buildWave
   käyttää samoja arvoja pisteiden laskentaan. Jos ne eroaisivat, viiva
   piirtyisi väärään kohtaan.
======================================================================= */

export default function HeroForecast({
  wave,
  forecast,
  effectiveRange,
  isPremium,
  selectRange,
  trh,
  WAVE_W,
  WAVE_H,
  WAVE_PAD,
}) {
  return (
    <div className="ah-wave">
      <div className="ah-wave-panel">
        <div className="ah-wave-head">
          <span className="ah-wave-title">
            {effectiveRange === "1d"
              ? trh("forecast.waveTitle1d", "Kp-ennuste · seuraavat 24 h", "Kp forecast · next 24 h")
              : trh("forecast.waveTitle3d", "Kp-ennuste · seuraavat 3 vrk", "Kp forecast · next 3 days")}
          </span>

          <div className="ah-range">
            {[
              ["1d", trh("forecast.range1d", "1 vrk", "1 day")],
              ["3d", trh("forecast.range3d", "3 vrk", "3 days")],
            ].map(([key, label]) => {
              const active = effectiveRange === key;
              const locked = key === "3d" && !isPremium;
              return (
                <button
                  key={key}
                  className={`ah-range-btn ${active ? "ah-range-btn--active" : ""}`}
                  onClick={() => selectRange(key)}
                  title={
                    locked
                      ? trh(
                          "forecast.rangeLocked",
                          "Koko 3 vrk ennuste Premiumilla",
                          "Full 3-day forecast with Premium"
                        )
                      : undefined
                  }
                >
                  {locked ? "🔒 " : ""}
                  {label}
                </button>
              );
            })}
            <span className="ah-wave-source">NOAA</span>
          </div>
        </div>

        {wave ? (
          <svg
            className="ah-wave-svg"
            viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
            role="img"
            aria-label={trh(
              "forecast.waveAria",
              "Revontuliaktiivisuuden Kp-ennuste",
              "Aurora activity Kp forecast"
            )}
          >
            <defs>
              <linearGradient id="ah-wave-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00ffc6" />
                <stop offset="60%" stopColor="#14e0ff" />
                <stop offset="100%" stopColor="#7d5fff" />
              </linearGradient>
              <linearGradient id="ah-wave-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00ffc6" stopOpacity="0.26" />
                <stop offset="100%" stopColor="#00ffc6" stopOpacity="0" />
              </linearGradient>
            </defs>

            {wave.yTicks.map((tick) => (
              <g key={tick.kp}>
                <line
                  className="ah-wave-grid"
                  x1={WAVE_PAD.l}
                  y1={tick.y}
                  x2={WAVE_W - WAVE_PAD.r}
                  y2={tick.y}
                />
                <text className="ah-wave-ylabel" x={WAVE_PAD.l - 7} y={tick.y + 3}>
                  {tick.kp}
                </text>
              </g>
            ))}

            {wave.dayTicks.map((tick, i) => (
              <g key={i}>
                <line
                  className="ah-wave-day-line"
                  x1={tick.x}
                  y1={WAVE_PAD.t}
                  x2={tick.x}
                  y2={wave.baseY}
                />
                <text className="ah-wave-xlabel" x={tick.x + 4} y={WAVE_H - 6}>
                  {tick.label}
                </text>
              </g>
            ))}

            {wave.areaPath && <path className="ah-wave-area" d={wave.areaPath} />}
            <path className="ah-wave-line" d={wave.openPath} />

            {wave.nowX != null && (
              <>
                <line
                  className="ah-wave-now"
                  x1={wave.nowX}
                  y1={WAVE_PAD.t}
                  x2={wave.nowX}
                  y2={wave.baseY}
                />
                <text className="ah-wave-now-label" x={wave.nowX + 4} y={WAVE_PAD.t + 9}>
                  {trh("forecast.now", "nyt", "now")}
                </text>
              </>
            )}

            {wave.peak && (
              <>
                <circle className="ah-wave-peak-dot" cx={wave.peak.x} cy={wave.peak.y} r="4" />
                <text
                  className="ah-wave-peak-label"
                  x={wave.peak.x > WAVE_W - 130 ? wave.peak.x - 8 : wave.peak.x + 8}
                  y={Math.max(wave.peak.y - 8, WAVE_PAD.t + 10)}
                  textAnchor={wave.peak.x > WAVE_W - 130 ? "end" : "start"}
                >
                  {trh("forecast.peak", "huippu", "peak")} Kp {wave.peak.kp.toFixed(1)}
                </text>
              </>
            )}
          </svg>
        ) : (
          <div className="ah-wave-empty">
            {forecast?.forecastUnavailable
              ? trh(
                  "forecast.unavailableSource",
                  "Ennuste ei ole juuri nyt saatavilla — NOAA:n lähde ei päivity. Nykytilanne yllä on ajan tasalla.",
                  "Forecast is unavailable right now — the NOAA source is not updating. Current conditions above are up to date."
                )
              : trh("forecast.loading", "Ladataan ennustetta…", "Loading forecast…")}
          </div>
        )}
      </div>
    </div>
  );
}