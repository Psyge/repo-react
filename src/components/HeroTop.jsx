import Heroglobe from "./Heroglobe";

/* ========================================================================
   HeroTop — heron yläosa: iso todennäköisyys, Kp-palkki, otsikko ja globe.

   Puhdas esityskomponentti, kaikki data tulee propseina AuroraHerolta.
======================================================================= */

export default function HeroTop({
  probability,
  statusWord,
  storm,
  kp,
  headline,
  nextLine,
  isPremium,
  navigate,
  t,
  trh,
}) {
  return (
    <div className="ah-dash-top">
      <div className="ah-dash-headline">
        <div className="ah-eyebrow">
          <span className="ah-eyebrow-dot" />
          {trh(
            "hero.eyebrow",
            "REVONTULI-AKTIIVISUUS · GEOMAGNEETTINEN INDEKSI",
            "NORTHERN LIGHTS ACTIVITY · GEOMAGNETIC INDEX"
          )}
        </div>

        {/* Pääluku: todennäköisyys-% (helpompi ymmärtää kuin Kp) */}
        <div className="ah-kp-row">
          <span className="ah-kp-big">
            {probability != null ? `${probability}%` : "–"}
          </span>

          <div className="ah-kp-meta">
            <span className="ah-kp-label">
              {trh("hero.probLabel", "REVONTULITODENNÄKÖISYYS", "AURORA PROBABILITY")}
            </span>

            <span className="ah-kp-status">{statusWord}</span>

            {storm && <span className="ah-kp-storm">{storm}</span>}
          </div>
        </div>

        {/* Kp palkkina: 0–9-asteikko, merkki G1-myrskyrajalla (Kp 5) */}
        <div className="ah-kp-bar">
          <div className="ah-kp-bar-head">
            <span className="ah-kp-bar-label">Kp Index</span>
            <span className="ah-kp-bar-value">{kp != null ? kp.toFixed(1) : "–"}</span>
          </div>

          <div className="ah-kp-bar-track">
            <div
              className="ah-kp-bar-fill"
              style={{ width: `${Math.min(((kp ?? 0) / 9) * 100, 100)}%` }}
            />
            <span
              className="ah-kp-bar-storm-mark"
              title={trh("hero.stormMark", "Myrskyraja (Kp 5 = G1)", "Storm threshold (Kp 5 = G1)")}
            />
          </div>

          <div className="ah-kp-bar-scale">
            <span>0</span>
            <span>3</span>
            <span>6</span>
            <span>9</span>
          </div>
        </div>

        <h1 className="ah-dash-desc">
          {headline} {nextLine}
        </h1>

        {/* Premium-CTA vain free-käyttäjille */}
        {!isPremium && (
          <div className="ah-probability-box">
            <div className="ah-premium-cta-container">
              <button
                className="ah-premium-link-btn"
                onClick={() => navigate("/premium")}
              >
                🔒 {t("forecast.unlock48")}
              </button>
              <span className="ah-premium-subtext">{t("premium.teaser.short")}</span>
            </div>
          </div>
        )}
      </div>

      <Heroglobe />
    </div>
  );
}