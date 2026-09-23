import { Link } from "react-router-dom";
import LiveCamSpotlight from "./LiveCamSpotlight";
import SeasonNotice from "./SeasonNotice";

export default function HeroPlaces({ featuredPlaces, activePlace, setActivePlace, currentKp, trh }) {
  return (
    <aside className="ah-dash-side">
      <SeasonNotice />
      <LiveCamSpotlight />
      <div className="ah-places-panel">
        <div className="ah-places-head">
          <h2 className="ah-places-title">{trh("hero.places", "Paikat", "Places")}</h2>
          {currentKp != null && <span className="ah-places-kp" title={trh("hero.kpGlobalHint", "Kp on planetaarinen indeksi — sama arvo kaikkialla", "Kp is a planetary index — the same value everywhere")}>Kp {currentKp.toFixed(1)}</span>}
        </div>
        <div className="ah-place-list">
          {featuredPlaces.map((place) => {
            const selected = activePlace?.id === place.id;
            const chance = place.currentKp != null ? place.prob : null;
            return (
              <button
                type="button"
                key={place.id}
                className={`ah-place-row ${selected ? "is-active-item" : ""}`}
                onClick={() => setActivePlace(place)}
                aria-pressed={selected}
              >
                <span className="ah-place-row-head">
                  <span className="ah-place-row-name"><span className="ah-item-dot-indicator" />{place.name}</span>
                  <span className="ah-place-row-prob">{chance != null ? `${chance}%` : "–"}</span>
                </span>
                <span className="ah-place-row-meta">
                  <span>☁ {place.currentClouds != null ? `${place.currentClouds}%` : "–"}</span>
                  <span>{place.currentTemp != null ? `${Math.round(place.currentTemp)}°C` : "–"}</span>
                </span>
              </button>
            );
          })}
        </div>
        {activePlace?.slug && <Link className="ah-place-more" to={`/places/${activePlace.slug}`}>{trh("places.readMore", "Tutustu valittuun paikkaan", "Explore this place")} →</Link>}
      </div>
    </aside>
  );
}
