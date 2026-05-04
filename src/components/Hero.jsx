export default function Hero({ kp }) {
  return (
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
            <span>Kp: <strong>{kp}</strong></span>
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
  );
}