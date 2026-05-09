import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "./components/Header";
import Sightings from "./components/Sightings";
import ReportButton from "./components/ReportButton";
import useTranslation from "./hooks/useTranslation";
import Forecast from "./components/Forecast";
import places from "./data/places";
import { calculateAurora } from "./utils/auroraEngine";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BASE = "https://report.masto84.workers.dev";

/** Lue premium deviceKey localStoragesta (sama kuin v2-puolella). */
function readDeviceKey() {
  try {
    const p = JSON.parse(localStorage.getItem("aurora_premium") || "null");
    if (!p || !p.deviceKey || !p.expiresAt) return "";
    if (p.expiresAt < Date.now()) return "";
    return p.deviceKey;
  } catch {
    return "";
  }
}

export default function HomePage() {
  const [kp, setKp] = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [placeData, setPlaceData] = useState({});

  const navigate = useNavigate();
  const { t } = useTranslation();

  const previewMapRef = useRef(null);
  const previewMapInstance = useRef(null);

  const aurora = calculateAurora({
    kp,
    speed: wind,
    density: 5,
    bz,
    cloudCover: 50,
    latitude: 67.5,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fetchSolar = async () => {
      try {
        const [kpRes, plasmaRes, magRes] = await Promise.all([
          fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"),
          fetch("https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json"),
          fetch("https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json"),
        ]);
        const kpData = await kpRes.json();
        const plasmaData = await plasmaRes.json();
        const magData = await magRes.json();

        const kpLast = kpData[kpData.length - 1];
        const plasmaLast = plasmaData[plasmaData.length - 1];
        const magLast = magData[magData.length - 1];

        const parsedKp = parseFloat(kpLast[1]);
        setKp(isNaN(parsedKp) ? 0 : parsedKp);
        setWind(parseFloat(plasmaLast[2]));
        setBz(parseFloat(magLast[3]));
      } catch (e) {
        console.error("SOLAR ERROR:", e);
      }
    };

    // Forecast — välitetään deviceKey jotta worker palauttaa premium-datan
    const fetchForecast = async () => {
      try {
        const deviceKey = readDeviceKey();
        const res = await fetch(`${BASE}/api/aurora/forecast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: 67.5, lon: 26, deviceKey }),
        });
        const data = await res.json();
        setForecast(data.slots || []);
      } catch (e) {
        console.error(e);
        setForecast([]);
      }
    };

    const fetchPlaces = async () => {
      try {
        const results = await Promise.all(
          places.slice(0, 3).map(async (place) => {
            try {
              const weatherRes = await fetch(`${BASE}/?lat=${place.lat}&lon=${place.lon}`);
              if (!weatherRes.ok) throw new Error(`weather ${weatherRes.status}`);
              const weather = await weatherRes.json();
              return {
                id: place.id,
                kp: kp ?? null,
                temp: weather.main?.temp != null ? Math.round(weather.main.temp) : null,
                clouds: weather.clouds?.all ?? null,
                wind: weather.wind?.speed ?? null,
              };
            } catch (err) {
              console.warn(`[places] ${place.id} fetch failed`, err);
              return { id: place.id, kp: kp ?? null, temp: null, clouds: null, wind: null };
            }
          })
        );
        const mapped = {};
        results.forEach((r) => { mapped[r.id] = r; });
        setPlaceData(mapped);
      } catch (e) {
        console.error(e);
      }
    };

    fetchSolar();
    fetchForecast();
    fetchPlaces();

    const interval = setInterval(() => {
      fetchSolar();
      fetchForecast();
      fetchPlaces();
    }, 60000);

    return () => clearInterval(interval);
  }, [kp]);

  useEffect(() => {
    if (previewMapInstance.current || !previewMapRef.current) return;

    const map = L.map(previewMapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    }).setView([67.5, 26], 4);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png").addTo(map);

    L.circleMarker([68.5, 27], {
      radius: 32,
      color: "#35ffe1",
      weight: 2,
      fillColor: "#00ffd5",
      fillOpacity: 0.18,
    }).addTo(map);

    previewMapInstance.current = map;
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
              <div className="kp-label">{t("probability.label")}</div>
              <div className="kp-big">
                <span>{aurora?.probability != null ? `${aurora.probability}%` : "--"}</span>
              </div>
              <div className="kp-meta">
                <span>{t("kp.label")}: <strong>{kp ?? "--"}</strong></span>
                <span>{t("wind.speed")}: <strong>{wind ?? "--"}</strong></span>
                <span>{t("bz.label")}: <strong>{bz ?? "--"}</strong></span>
              </div>
            </div>

            <div className="map-preview" onClick={() => navigate("/map")} style={{ cursor: "pointer", position: "relative" }}>
              <div ref={previewMapRef} style={{ width: "100%", height: "100%" }} />
              <div className="map-preview-cta"><span>{t("map.open")}</span></div>
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
                <div
                  key={place.id}
                  className="place-row"
                  onClick={() => navigate(`/map?lat=${place.lat}&lon=${place.lon}`)}
                >
                  <div className="place-name">{place.name}</div>
                  <div className="data-group">
                    <div className="data-item">
                      <span className="label">KP</span>
                      <span className="value kp-val kp-mid">{data?.kp ?? "--"}</span>
                    </div>
                    <div className="data-item">
                      <span className="label">{t("weather.clouds")}</span>
                      <span className="value">{data?.clouds != null ? `${data.clouds}%` : "--"}</span>
                    </div>
                    <div className="data-item">
                      <span className="label">{t("weather.temp")}</span>
                      <span className="value">{data?.temp != null ? `${data.temp}°` : "--"}</span>
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
              <div className="blog-card-read">{t("blog.read")}</div>
            </Link>
            <Link to="/blog/forecast" className="blog-card">
              <div className="blog-card-tag">GUIDE</div>
              <h2>{t("blog.post2.title")}</h2>
              <p>{t("blog.post2.excerpt")}</p>
              <div className="blog-card-read">{t("blog.read")}</div>
            </Link>
            <Link to="/blog/timing" className="blog-card">
              <div className="blog-card-tag">GUIDE</div>
              <h2>{t("blog.post3.title")}</h2>
              <p>{t("blog.post3.excerpt")}</p>
              <div className="blog-card-read">{t("blog.read")}</div>
            </Link>
          </div>
        </section>
      </main>

      <footer className="footer"><p>© RepoTracker</p>
      <Link to="/privacy">{t('footer.privacy')}</Link> + <Link to="/terms">{t('privacy.q.terms')}</Link>
      </footer>
    </div>
  );
}
