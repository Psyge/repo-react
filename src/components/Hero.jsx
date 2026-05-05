import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";

export default function Hero({ kp, wind, bz }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="hero-split container">
      <div className="hero-text">
        <h1>{t("app.tagline")}</h1>

        <p className="tagline">
          {t("hero.sub")}
        </p>
      </div>

      <div className="hero-grid">
        {/* KP BOX */}
        <div className="kp-display">
          <div className="kp-label">
            {t("probability.label")}
          </div>

          <div className="kp-big">
            <span>{kp ?? "--"}</span>
          </div>

          <div className="kp-meta">
            <span>
              {t("kp.label")}: <strong>{kp ?? "--"}</strong>
            </span>

            <span>
              {t("wind.speed")}: <strong>{wind ?? "--"}</strong>
            </span>

            <span>
              {t("bz.label")}: <strong>{bz ?? "--"}</strong>
            </span>
          </div>
        </div>

        {/* MAP PREVIEW */}
        <div
          className="map-preview"
          onClick={() => navigate("/map")}
          style={{ cursor: "pointer" }}
        >
          <div className="map-preview-cta">
            {t("map.open")}
          </div>
        </div>
      </div>
    </section>
  );
}