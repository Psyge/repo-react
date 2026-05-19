import { Link } from "react-router-dom";
import { setLang } from "../utils/i18n";
import useTranslation from "../hooks/useTranslation";
import { FaInstagram, FaTiktok } from "react-icons/fa";
import { usePremium } from "../context/PremiumContext";

export default function Header() {
  const { t } = useTranslation();
  const { premium } = usePremium();

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
  className={
    premium.active
      ? "premium-link active"
      : "premium-link"
  }
>
  {premium.active
    ? "✨ Premium Active"
    : "Premium"}
</Link>
        </nav>

        <div className="header-socials">
          <div className="social-links">
            <a
              href="https://instagram.com/repotracker"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>

            <a
              href="https://tiktok.com/@repotracker"
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
            >
              <FaTiktok />
            </a>
          </div>

          <div className="lang-switcher">
            <button onClick={() => setLang("en")}>EN</button>
            <button onClick={() => setLang("fi")}>FI</button>
          </div>
        </div>
      </div>
    </header>
  );
}