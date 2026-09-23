/* ========================================================================
   HeroTop — heron yläosa.

   Tietohierarkia: SIJAINTI → SANALLINEN TUOMIO → prosentti.

   Käyttäjä kysyy "kannattaako tänä yönä valvoa?", ei "mikä on Kp-indeksi".
   Siksi iso teksti on vastaus ("Hyvä mahdollisuus nähdä revontulia") ja
   prosentti on sen alla pienempänä tarkennuksena. Kp-luku ja -palkki
   siirtyivät mittarikortteihin muiden mittausarvojen joukkoon.
======================================================================= */

export default function HeroTop({
  placeName,
  verdict,
  probability,
  updatedText,
  headline,
  nextLine,
  storm,
  isPremium,
  navigate,
  t,
  trh,
  activePlace,
  places,
  onSelectPlace,
}) {
  return (
    <div className="ah-dash-top">
      <div className="ah-dash-headline">
        {/* Aiemmin tässä oli "REVONTULI-AKTIIVISUUS · GEOMAGNEETTINEN INDEKSI".
            Päivitysaika on käyttäjälle hyödyllisempi kuin mittaristotermit —
            varsinkin nyt kun lähteet voivat olla jäässä. */}
        {updatedText && (
          <div className="ah-eyebrow">
            <span className="ah-eyebrow-dot" />
            {updatedText}
          </div>
        )}

        <div className="ah-place-header">
          <label htmlFor="hero-place-select">{trh("hero.placeSelect", "VALITSE OMA PAIKKA", "CHOOSE A PLACE")}</label>
          <select id="hero-place-select" value={activePlace?.id || ""} onChange={(e) => onSelectPlace(places.find((p) => p.id === e.target.value))}>
            {!activePlace && <option value="">{trh("hero.selectPlace", "Valitse paikka", "Choose a place")}</option>}
            {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select>
        </div>

        {placeName && <div className="ah-city-name">{placeName}</div>}

        <h1 className="ah-verdict">{verdict}</h1>

        <div className="ah-verdict-sub">
          {probability != null
            ? `${probability} % ${trh("hero.probWord", "todennäköisyys", "probability")}`
            : trh("hero.probUnknown", "Todennäköisyyttä ei saatavilla", "Probability unavailable")}
          {storm && <span className="ah-kp-storm"> · {storm}</span>}
        </div>

        {/* Tarkentava rivi: mitä taivaalla tapahtuu ja milloin seuraavaksi */}
        <p className="ah-dash-desc">
          {headline} {nextLine}
        </p>

        <div className="ah-hero-actions">
          <button className="ah-map-link-btn" onClick={() => navigate("/map")}>{trh("hero.openMap", "Tutki kartalla", "Explore the map")} ↗</button>

        {/* Premium-CTA vain free-käyttäjille */}
        {!isPremium && (
          <div className="ah-probability-box">
            <div className="ah-premium-cta-container">
              <button
                className="ah-premium-link-btn"
                onClick={() => navigate("/premium")}
              >
                🔒 {t("forecast.unlock48")}
              </button>
              <span className="ah-premium-subtext">{t("premium.teaser.short")}</span>
            </div>
          </div>
        )}
        </div>
        <p className="ah-photo-note">{trh("hero.photoNote", "Taustakuva on tunnelmakuva. Tämän hetken tilanne näkyy ennusteessa.", "The background is an illustration. Check the forecast for current conditions.")}</p>
      </div>
    </div>
  );
}
