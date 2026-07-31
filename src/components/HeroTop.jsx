import Heroglobe from "./Heroglobe";

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

        {placeName && (
          <div className="ah-place-header">
            <span aria-hidden="true">📍</span> {placeName}
          </div>
        )}

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

      <div className="ah-globe-slot">
        <Heroglobe />
        <button
          type="button"
          className="ah-globe-cta"
          onClick={() => navigate("/map")}
        >
          {trh("hero.openGlobe", "Seuraa revontulia kartalla →", "Track the aurora on the map →")}
        </button>
      </div>
    </div>
  );
}