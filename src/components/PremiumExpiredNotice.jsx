import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { usePremium } from "../context/PremiumContext";

/* ========================================================================
   PremiumExpiredNotice — kertaluontoinen ilmoitus kun premium päättyy.

   Aiemmin päättyminen oli täysin hiljainen: luvut vain vähenivät ja
   maksanut asiakas jäi ihmettelemään. Tämä kertoo mitä tapahtui ja
   tarjoaa jatkon samassa hetkessä.

   Näkyy kerran per istunto (sessionStorage-lippu PremiumContextissa).
======================================================================= */

export default function PremiumExpiredNotice() {
  const { justExpired, dismissExpired } = usePremium();
  const navigate = useNavigate();
  const { currentLanguage, t } = useTranslation();

  const trh = (key, fi, en) => {
    const s = t(key);
    if (s != null && s !== key) return s;
    return currentLanguage === "en" ? en : fi;
  };

  if (!justExpired) return null;

  return (
    <div className="premium-expired" role="status">
      <span className="premium-expired-text">
        {trh(
          "premium.expiredNotice",
          "Premium-aikasi päättyi. Tarkat luvut ja 3 vrk:n ennuste ovat taas käytössä uudella jaksolla.",
          "Your Premium has ended. Detailed values and the 3-day forecast are available again with a new pass."
        )}
      </span>

      <button
        className="premium-expired-cta"
        onClick={() => {
          dismissExpired();
          navigate("/premium");
        }}
      >
        {trh("premium.expiredCta", "Jatka Premiumia", "Renew Premium")}
      </button>

      <button
        className="premium-expired-close"
        onClick={dismissExpired}
        aria-label={trh("common.close", "Sulje", "Close")}
      >
        ✕
      </button>
    </div>
  );
}