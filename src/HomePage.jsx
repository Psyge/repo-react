import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./components/Header";
import Sightings from "./components/Sightings";
import ReportButton from "./components/ReportButton";
import useTranslation from "./hooks/useTranslation";

export default function HomePage() {
  const [kp, setKp] = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz] = useState(null);

  const navigate = useNavigate();
  const { t } = useTranslation();

  const BASE = "https://report.masto84.workers.dev";

  useEffect(() => {
    const fetchSolar = async () => {
      try {
        const res = await fetch(`${BASE}/api/solar`);
        const data = await res.json();

        setKp(data.kp ?? 0);
        setWind(data.speed ?? 0);
        setBz(data.bz ?? 0);
      } catch (e) {
        console.error(e);
      }
    };

    fetchSolar();

    const interval = setInterval(fetchSolar, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <Header />

      <main>
        {/* HERO */}
        <section className="hero-split container">
          <div className="hero-text">
            <h1>{t("hero.title")}</h1>

            <p className="tagline">
              {t("hero.sub")}
            </p>
          </div>

          <div className="hero-grid">
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

        {/* SIGHTINGS */}
        <section className="container">
          <h2>{t("sightings.title")}</h2>
          <p>{t("sightings.sub")}</p>

          <ReportButton />
          <Sightings />
        </section>

        {/* LOCATIONS */}
        <section className="container">
          <h2>{t("locations.title")}</h2>
          <p>{t("locations.sub")}</p>

          <div className="locations">
            <div className="location-card">Rovaniemi</div>
            <div className="location-card">Levi</div>
            <div className="location-card">Saariselkä</div>
          </div>
        </section>

        {/* ARTICLES */}
        <section className="container">
          <h2>{t("home.articles.title")}</h2>
          <p>{t("home.articles.sub")}</p>

          <div className="articles">
            <div className="article-card">
              {t("blog.post1.title")}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© RepoTracker</p>
      </footer>
    </div>
  );
}