import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./components/Header";
import Sightings from "./components/Sightings";
import ReportButton from "./components/ReportButton";

export default function HomePage() {
  const [kp, setKp] = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz] = useState(null);

  const navigate = useNavigate();

  const BASE = "https://report.masto84.workers.dev";

  // 🔥 hae solar data
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
            <h1>Real-time Northern Lights visibility for Lapland</h1>
            <p className="tagline">
              Live Kp index, solar wind speed and Bz orientation
            </p>
          </div>

          <div className="hero-grid">
            {/* KP BOX */}
            <div className="kp-display">
              <div className="kp-label">Aurora probability</div>

              <div className="kp-big">
                <span>{kp ?? "--"}</span>
              </div>

              <div className="kp-meta">
                <span>Kp: <strong>{kp ?? "--"}</strong></span>
                <span>Wind: <strong>{wind ?? "--"}</strong></span>
                <span>Bz: <strong>{bz ?? "--"}</strong></span>
              </div>
            </div>

            {/* MAP PREVIEW */}
            <div
              className="map-preview"
              onClick={() => navigate("/map")}
              style={{ cursor: "pointer" }}
            >
              <div className="map-preview-cta">
                Open live map →
              </div>
            </div>
          </div>
        </section>

        {/* SIGHTINGS */}
        <section className="container">
  

  <ReportButton />
  <Sightings />
</section>

        {/* LOCATIONS */}
        <section className="container">
          <h2>Top viewing locations</h2>

          <div className="locations">
            <div className="location-card">Rovaniemi</div>
            <div className="location-card">Levi</div>
            <div className="location-card">Saariselkä</div>
          </div>
        </section>

        {/* ARTICLES */}
        <section className="container">
          <h2>Guides & articles</h2>

          <div className="articles">
            <div className="article-card">
              Best time to see aurora
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p>© Aurora Tracker</p>
      </footer>
    </div>
  );
}