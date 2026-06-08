import { Link } from "react-router-dom";
import { setLang } from "../utils/i18n"; // PALAUTETTU TÄMÄ TAKAISIN!
import useTranslation from "../hooks/useTranslation";
import { FaInstagram, FaTiktok } from "react-icons/fa";
import { usePremium } from "../context/PremiumContext";

export default function Header() {
  const { t, changeLanguage } = useTranslation();
  const { premium } = usePremium();

  // Luodaan oma väli-funktio kielen vaihtamiselle, joka hoitaa molemmat järjestelmät!
  const handleLanguageChange = (newLang) => {
    // 1. Päivitetään teidän oma i18n-moottori (vaihtaa nappien ja käännöstiedostojen kielet)
    setLang(newLang);
    
    // 2. Päivitetään Reactin tila (laukaisee Contentful-haut uusiksi)
    if (typeof changeLanguage === "function") {
      changeLanguage(newLang);
    }
  };

  return (
    <header className="header">
      <div className="header-inner">

        <Link to="/" className="brand">
          RepoTracker
        </Link>

        <nav className="main-nav">
          <Link to="/">{t("nav.home")}</Link>
          <Link to="/map">{t("nav.map")}</Link>
          <Link to="/blog">{t("nav.blog")}</Link>
          <Link to="/faq">{t("nav.faq")}</Link>
          <Link
            to="/premium"
            className={premium.active ? "premium-link active" : "premium-link"}
          >
            {premium.active ? "✨ Premium" : "Premium"}
          </Link>
        </nav>

        <div className="header-actions">

          <div className="header-socials">
            <a href="https://instagram.com/repotracker_" target="_blank" rel="noreferrer" aria-label="Instagram">
              <FaInstagram />
            </a>
            <a href="https://tiktok.com/@repotracker" target="_blank" rel="noreferrer" aria-label="TikTok">
              <FaTiktok />
            </a>
          </div>

          {/* KORJATTU: Kutsutaan uutta handleLanguageChange-funktiota */}
          <div className="lang-switcher">
            <button onClick={() => handleLanguageChange("en")}>
              EN
            </button>
            <button onClick={() => handleLanguageChange("fi")}>
              FI
            </button>
          </div>

        </div>

      </div>
    </header>
  );
}