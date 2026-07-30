import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import LiveCamSpotlight from "./LiveCamSpotlight";
import SeasonNotice from "./SeasonNotice";

export default function HeroPlaces({
  featuredPlaces,
  activePlace,
  setActivePlace,
  trh,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <>
      <aside className="ah-dash-side">
        <SeasonNotice />

        <LiveCamSpotlight />

        <div className="ah-places-panel">
          <h2 className="ah-places-title">
            {trh("hero.places", "Paikat", "Places")}
          </h2>

          <div className="ah-place-list">
            {featuredPlaces.map((p) => {
              const isSelected = activePlace && p.id === activePlace.id;

              const prob = p.currentKp != null ? p.prob : null;

              const barColor =
                prob == null
                  ? "#475569"
                  : prob >= 70
                  ? "#00ffc6"
                  : prob >= 40
                  ? "#fee440"
                  : "#f87171";

              return (
                <div
                  key={p.id}
                  className={`ah-place-row ${
                    isSelected ? "is-active-item" : ""
                  }`}
                  onClick={() => {
                    setActivePlace(p);
                    setIsPopupOpen(true);
                  }}
                >
                  <div className="ah-place-row-head">
                    <span className="ah-place-row-name">
                      <span
                        className="ah-item-dot-indicator"
                        style={
                          isSelected
                            ? {
                                background: barColor,
                                boxShadow: `0 0 8px ${barColor}`,
                              }
                            : {}
                        }
                      />
                      {p.name}
                    </span>

                    <span
                      className="ah-place-row-prob"
                      style={{ color: barColor }}
                    >
                      {prob != null ? `${prob}%` : "–"}
                    </span>
                  </div>

                  <div className="ah-place-row-meta">
                    <span>
                      Kp {p.currentKp != null ? p.currentKp.toFixed(1) : "–"}
                    </span>

                    <span>
                      ☁{" "}
                      {p.currentClouds != null
                        ? `${p.currentClouds}%`
                        : "–"}
                    </span>
                  </div>

                  <div className="ah-place-bar-track">
                    <div
                      className="ah-place-bar-fill"
                      style={{
                        width: prob != null ? `${prob}%` : "0%",
                        background: `linear-gradient(to right, ${barColor}80, ${barColor})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

            

      {isPopupOpen && activePlace && (
        <div
          className="ah-popup-backdrop"
          onClick={() => setIsPopupOpen(false)}
        >
          <div
            className="ah-popup-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="ah-popup-drag-handle"
              onClick={() => setIsPopupOpen(false)}
            />

            <h3>📍 {activePlace.name}</h3>

            <div className="ah-popup-metrics">
              <span>
                Kp{" "}
                {activePlace.currentKp != null
                  ? activePlace.currentKp.toFixed(1)
                  : "--"}
              </span>

              <span>
                ☁{" "}
                {activePlace.currentClouds != null
                  ? `${activePlace.currentClouds}%`
                  : "--"}
              </span>

              <span>{activePlace.prob}%</span>
            </div>

            {activePlace.description ? (
              <div className="ah-popup-content">
                <p>{activePlace.description}</p>

                <button
                  className="ah-popup-readmore-btn"
                  onClick={() => {
                    setIsPopupOpen(false);
                    navigate(`/places/${activePlace.slug}`);
                  }}
                >
                  ✨ {t("places.readMore")}
                </button>
              </div>
            ) : (
              <p className="ah-popup-empty">
                {trh(
                  "places.noDescription",
                  "Ei kuvausta saatavilla valitulla kielellä.",
                  "No description available in this language."
                )}
              </p>
            )}

            <button
              className="ah-popup-map-btn"
              onClick={() => {
                setIsPopupOpen(false);
                navigate(
                  `/map?lat=${activePlace.lat}&lon=${activePlace.lon}`
                );
              }}
            >
              {t("places.viewAuroraMap")} 🗺️
            </button>
          </div>
        </div>
      )}
    </>
  );
}