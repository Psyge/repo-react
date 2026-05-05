import { Link } from "react-router-dom";
import { setLang } from "../utils/i18n";
import useTranslation from "../hooks/useTranslation";

export default function Header() {
  const { t } = useTranslation();

  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">RepoTracker</div>

        <nav>
          <Link to="/">{t("nav.home")}</Link>
          <Link to="/map">{t("nav.map")}</Link>
          <Link to="/blog">{t("nav.blog")}</Link>
          <Link to="/faq">{t("nav.faq")}</Link>
        </nav>

        <div className="lang-switcher">
          <button onClick={() => setLang("en")}>EN</button>
          <button onClick={() => setLang("fi")}>FI</button>
        </div>
      </div>
    </header>
  );
}