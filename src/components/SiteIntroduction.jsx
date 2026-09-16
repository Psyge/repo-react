import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";

// Same content in build-time HTML and the browser. Never freeze live readings.
export default function SiteIntroduction() {
  const { t, currentLanguage } = useTranslation();
  return (
    <section className="block">
      <div className="container" style={{ maxWidth: 860 }}>
        <h2>{currentLanguage === "fi" ? "Näin käytät RepoTrackeria" : "How to use RepoTracker"}</h2>
        <p>{t("about.intro")}</p>
        <p>{t("about.a.whatwedo1")}</p>
        <p>
          <Link to="/map">{t("nav.map")}</Link>{" · "}
          <Link to="/blog">{t("nav.blog")}</Link>{" · "}
          <Link to="/faq">{t("nav.faq")}</Link>{" · "}
          <Link to="/about">{t("footer.about")}</Link>
        </p>
      </div>
    </section>
  );
}
