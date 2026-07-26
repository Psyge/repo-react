import { useMemo } from "react";
import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { isAuroraSeason, seasonStartDate, formatSeasonStart } from "../utils/auroraSeason";

/* ========================================================================
   SeasonNotice — näkyy VAIN kun revontulikausi ei ole käynnissä.

   Kesällä hero jäisi muuten tyhjäksi: LiveCamSpotlight piiloutuu koska
   kamerat eivät kuvaa, eikä revontulista ole mitään kerrottavaa. Tämä
   täyttää tilan sillä mitä taivaalla oikeasti on — yöttömällä yöllä — ja
   kertoo milloin kausi alkaa, jotta käyttäjällä on syy palata.

   Sijainti: AuroraHero .ah-dash-side, LiveCamSpotlightin yläpuolella.
======================================================================= */

const DEFAULT_LAT = 66.5;   // Rovaniemi ≈ napapiiri
const DEFAULT_LON = 26;

export default function SeasonNotice({ lat = DEFAULT_LAT, lon = DEFAULT_LON }) {
  const { currentLanguage, t } = useTranslation();

  const trh = (key, fi, en) => {
    const s = t(key);
    if (s != null && s !== key) return s;
    return currentLanguage === "en" ? en : fi;
  };

  /* Laskenta on kevyt mutta ei ilmainen — tehdään kerran per mount */
  const season = useMemo(() => {
    const inSeason = isAuroraSeason(lat, lon);
    if (inSeason) return { inSeason: true, startsText: null };
    const start = seasonStartDate(lat, lon);
    return {
      inSeason: false,
      startsText: formatSeasonStart(start, currentLanguage),
    };
  }, [lat, lon, currentLanguage]);

  if (season.inSeason) return null;

  return (
    <div className="ah-season-panel">
      <div className="ah-season-head">
        <span className="ah-season-icon" aria-hidden="true">☀️</span>
        <span className="ah-season-title">
          {trh("season.offTitle", "Yötön yö", "Midnight sun")}
        </span>
      </div>

      <p className="ah-season-body">
        {trh(
          "season.offBody",
          "Aurinko ei laske tarpeeksi alas, joten revontulia ei näy vaikka niitä esiintyisi.",
          "The sun doesn't set low enough, so the northern lights stay invisible even when they occur."
        )}
      </p>

      {season.startsText && (
        <p className="ah-season-starts">
          {trh("season.starts", "Kausi alkaa noin", "Season starts around")}{" "}
          <strong>{season.startsText}</strong>
        </p>
      )}

      <Link to="/MidNightSunV2" className="ah-season-cta">
        {trh("season.cta", "Katso auringon kulku →", "Explore the sun's path →")}
      </Link>
    </div>
  );
}