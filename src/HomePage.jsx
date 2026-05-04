import Header from "./components/Header";

export default function HomePage() {
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
                <span>--</span>
              </div>

              <div className="kp-meta">
                <span>Kp: <strong>--</strong></span>
                <span>Wind: <strong>--</strong></span>
                <span>Bz: <strong>--</strong></span>
              </div>
            </div>

            {/* MAP PREVIEW */}
            <div className="map-preview">
              <div className="map-preview-cta">
                Open live map →
              </div>
            </div>
          </div>
        </section>

        {/* SIGHTINGS */}
        <section className="container">
          <h2>Latest sightings</h2>

          <div className="sightings">
            <div className="sighting-card">No data yet</div>
          </div>
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