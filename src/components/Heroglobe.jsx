import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";

/* ========================================================================
   HeroGlobe — kevyt CSS-maapallo etusivun heroon.
   Ei WebGL:ää: pyörivä tekstuuri + revontulihehku + pallovarjostus.
   Klikkaus vie oikeaan 3D-globeen map-sivulle.
   Tyylit: Aurorahero.css (.ah-globe*)
======================================================================= */
export default function HeroGlobe() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const raw = t("hero.openGlobe");
  const label = raw && raw !== "hero.openGlobe" ? raw : "Avaa 3D-kartta";

  return (
    <button
      type="button"
      className="ah-globe"
      onClick={() => navigate("/map")}
      aria-label={label}
    >
      <span className="ah-globe-clip" aria-hidden="true">
        <span className="ah-globe-map" />
      </span>
      <span className="ah-globe-aurora" aria-hidden="true" />
      <span className="ah-globe-shade" aria-hidden="true" />
      <span className="ah-globe-label">{label} →</span>
    </button>
  );
}