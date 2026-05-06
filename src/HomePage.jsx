import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "./components/Header";
import Sightings from "./components/Sightings";
import ReportButton from "./components/ReportButton";
import useTranslation from "./hooks/useTranslation";
import Forecast from "./components/Forecast";
import places from "./data/places";
import { calculateAurora } from "./utils/auroraEngine";

// 🔥 helper (oikea aikaslot)
const getCurrentSlot = (slots) => {
  if (!slots || slots.length === 0) return null;

  const now = Date.now();

  return slots.reduce((closest, slot) => {
    const diff = Math.abs(new Date(slot.tsUtc).getTime() - now);
    if (!closest || diff < closest.diff) {
      return { slot, diff };
    }
    return closest;
  }, null)?.slot;
};

export default function HomePage() {
  const [kp, setKp] = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [placeData, setPlaceData] = useState({});

  const navigate = useNavigate();
  const { t } = useTranslation();

  const BASE = "https://report.masto84.workers.dev";

  // 🔥 aurora laskenta
  const aurora = calculateAurora({
    kp,
    speed: wind,
    density: 5,
    bz,
    cloudCover: 50,
    latitude: 67.5,
  });

  useEffect(() => {
    // 🔥 FORECAST + HERO
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

        setForecast(data.slots || []);

        const currentSlot = getCurrentSlot(data.slots);

        setKp(currentSlot?.kp ?? 0);
        setWind(data.current?.speed ?? null);
        setBz(data.current?.bz ?? null);

      } catch (e) {
        console.error(e);
        setForecast([]);
      }
    };

    // 🔥 PLACES DATA
    const fetchPlaces = async () => {
      try {
        const results = await Promise.all(
          places.slice(0, 3).map(async (place) => {
            const res = await fetch(`${BASE}/api/aurora/forecast`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                lat: place.lat,
                lon: place.lon,
              }),
            });

            const data = await res.json();
            const slot = getCurrentSlot(data.slots);

            return {
              id: place.id,
              kp: slot?.kp,
              wind: data.current?.speed,
            };
          })
        );

        const mapped = {};
        results.forEach((r) => {
          mapped[r.id] = r;
        });

        setPlaceData(mapped);
      } catch (e) {
        console.error(e);
      }
    };

    fetchForecast();
    fetchPlaces();

    const interval = setInterval(() => {
      fetchForecast();
      fetchPlaces();
    }, 60000);

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
            <p className="tagline">{t("hero.sub")}</p>
          </div>

          <div className="hero-grid">
            <div className="kp-display">
              <div className="kp-label">
                {t("probability.label")}
              </div>

              <div className="kp-big">
                <span>
                  {aurora?.probability != null
                    ? `${aurora.probability}%`
                    : "--"}
                </span>
              </div>

              <div className="kp-meta">
                <span>
                  {t("kp.label")}: <strong>{kp ?? "--"}</strong>
                </span>

                <span>
                  {t("wind.speed")}:{" "}
                  <strong>{wind ?? "--"}</strong>
                </span>

                <span>
                  {t("bz.label")}:{" "}
                  <strong>{bz ?? "--"}</strong>
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

        {/* FORECAST */}
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

        {/* LOCATIONS */}
        <section className="container">
          <h2>{t("locations.title")}</h2>
          <p>{t("locations.sub")}</p>

          <div className="places-grid">
            {places.slice(0, 3).map((place) => {
              const data = placeData[place.id];

              return (
                <div key={place.id} className="place-row">
                  <div className="place-name">
                    {place.name}
                  </div>

                  <div className="data-group">
                    <div className="data-item">
                      <span className="label">KP</span>
                      <span className="value kp-val kp-mid">
                        {data?.kp ?? "--"}
                      </span>
                    </div>

                    <div className="data-item">
                      <span className="label">Wind</span>
                      <span className="value">
                        {data?.wind ?? "--"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ARTICLES */}
        <section className="container">
          <h2>{t("home.articles.title")}</h2>
          <p>{t("home.articles.sub")}</p>

          <div className="home-articles">
            <Link to="/blog/photography" className="blog-card">
              <div className="blog-card-tag">GUIDE</div>
              <h2>{t("blog.post1.title")}</h2>
              <p>{t("blog.post1.excerpt")}</p>
              <div className="blog-card-read">
                {t("blog.read")}
              </div>
            </Link>

            <Link to="/blog/forecast" className="blog-card">
              <div className="blog-card-tag">GUIDE</div>
              <h2>{t("blog.post2.title")}</h2>
              <p>{t("blog.post2.excerpt")}</p>
              <div className="blog-card-read">
                {t("blog.read")}
              </div>
            </Link>

            <Link to="/blog/best-time" className="blog-card">
              <div className="blog-card-tag">GUIDE</div>
              <h2>{t("blog.post3.title")}</h2>
              <p>{t("blog.post3.excerpt")}</p>
              <div className="blog-card-read">
                {t("blog.read")}
              </div>
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