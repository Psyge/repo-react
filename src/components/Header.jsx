import { Link, NavLink } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { FaInstagram, FaTiktok } from "react-icons/fa";
import { usePremium } from "../context/PremiumContext";

export default function Header() {
  const { t, changeLanguage } = useTranslation();
  const { premium } = usePremium();

  // Luodaan oma väli-funktio kielen vaihtamiselle, joka hoitaa molemmat järjestelmät!
  const handleLanguageChange = (newLang) => {
    // 1. Päivitetään teidän oma i18n-moottori (vaihtaa nappien ja käännöstiedostojen kielet)
    
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
          <NavLink to="/" end>{t("nav.home")}</NavLink>
          <NavLink to="/map">{t("nav.map")}</NavLink>
          <NavLink to="/blog">{t("nav.blog")}</NavLink>
          <NavLink to="/faq">{t("nav.faq")}</NavLink>
          <NavLink
            to="/premium"
            className={({ isActive }) => `premium-link${premium.active || isActive ? " active" : ""}`}
          >
            {premium.active ? "✨ Premium" : "Premium"}
          </NavLink>
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
