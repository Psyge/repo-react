import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "./components/Header";
import Sightings from "./components/Sightings";
import ReportButton from "./components/ReportButton";
import useTranslation from "./hooks/useTranslation";
import Forecast from "./components/Forecast";
import places from "./data/places";
import { calculateAurora } from "./utils/auroraEngine";

export default function HomePage() {
  const [kp, setKp] = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz] = useState(null);
  const [forecast, setForecast] = useState([]);

  const navigate = useNavigate();
  const { t } = useTranslation();

  const aurora = calculateAurora({
  kp,
  speed: wind,
  density: 5, // jos ei ole → default
  bz,
  cloudCover: 50, // jos ei ole → default
  latitude: 67.5,
});

  const BASE = "https://report.masto84.workers.dev";

  useEffect(() => {
    // 🔥 FORECAST (POST + slots)
  const fetchForecast = async () => {
  try {
    const res = await fetch(`${BASE}/api/aurora/forecast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        lat: 67.5,
        lon: 26,
      }),
    });

    const data = await res.json();

    console.log("FORECAST DATA:", data);

    // 🔥 forecast
    setForecast(data.slots || []);

    // 🔥 current (hero)
    setWind(data.current?.speed ?? 0);
    setBz(data.current?.bz ?? 0);
    setKp(data.slots?.[0]?.kp ?? 0);

  } catch (e) {
    console.error(e);
    setForecast([]);
  }
};

    fetchForecast();
   

    const forecastInterval = setInterval(fetchForecast, 60000);
    

    return () => {
      clearInterval(forecastInterval);
      
    };
  }, []);

  return (
    <div>
      <Header />

      <main>
        {/* HERO */}
        <section className="hero-split container">
          <div className="hero-text">
            <h1>{t("hero.title")}</h1>
            <p className="tagline">{t("hero.sub")}</p>
          </div>

          <div className="hero-grid">
            <div className="kp-display">
              <div className="kp-label">
                {t("probability.label")}
              </div>

              <div className="kp-big">
  <span>
    {aurora?.probability != null ? `${aurora.probability}%` : "--"}
  </span>
</div>

<div className="kp-meta">
  <span>
    {t("kp.label")}: <strong>{kp ?? "--"}</strong>
  </span>

  <span>
  {t("wind.speed")}: <strong>
    {wind ? wind : "--"}
  </strong>
</span>

<span>
  {t("bz.label")}: <strong>
    {bz ? bz : "--"}
  </strong>
</span>
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

        {/* 🔥 FORECAST */}
        <section className="container">
          <Forecast data={forecast} />
        </section>

        {/* SIGHTINGS */}
        <section className="container">
          <h2>{t("sightings.title")}</h2>
          <p>{t("sightings.sub")}</p>

          <ReportButton />
          <Sightings />
        </section>

        {/* 🔥 LOCATIONS */}
        <section className="container">
          <h2>{t("locations.title")}</h2>
          <p>{t("locations.sub")}</p>

          <div className="places-grid">
            {places.slice(0, 3).map((place) => (
              <div key={place.id} className="place-row">
                <div className="place-name">{place.name}</div>

                <div className="data-group">
                  <div className="data-item">
                    <span className="label">KP</span>
                    <span className="value kp-val kp-mid">--</span>
                  </div>

                  <div className="data-item">
                    <span className="label">Wind</span>
                    <span className="value">--</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 🔥 ARTICLES */}
        <section className="container">
          <h2>{t("home.articles.title")}</h2>
          <p>{t("home.articles.sub")}</p>

          <div className="home-articles">
            <Link to="/blog/photography" className="blog-card">
              <div className="blog-card-tag">GUIDE</div>
              <h2>{t("blog.post1.title")}</h2>
              <p>{t("blog.post1.excerpt")}</p>
              <div className="blog-card-read">{t("blog.read")}</div>
            </Link>

            <Link to="/blog/forecast" className="blog-card">
              <div className="blog-card-tag">GUIDE</div>
              <h2>{t("blog.post2.title")}</h2>
              <p>{t("blog.post2.excerpt")}</p>
              <div className="blog-card-read">{t("blog.read")}</div>
            </Link>

            <Link to="/blog/best-time" className="blog-card">
              <div className="blog-card-tag">GUIDE</div>
              <h2>{t("blog.post3.title")}</h2>
              <p>{t("blog.post3.excerpt")}</p>
              <div className="blog-card-read">{t("blog.read")}</div>
            </Link>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© RepoTracker</p>
      </footer>
    </div>
  );
}