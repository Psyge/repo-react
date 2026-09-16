import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";

// Same content in build-time HTML and the browser. Never freeze live readings.
export default function SiteIntroduction() {
  const { t, currentLanguage } = useTranslation();
  return (
    <section className="block site-introduction-section">
      <div className="container">
        <article className="blog-card site-introduction-card">
          <h2>{currentLanguage === "fi" ? "Näin käytät RepoTrackeria" : "How to use RepoTracker"}</h2>
          <p>{t("about.intro")}</p>
          <p>{t("about.a.whatwedo1")}</p>
          <div className="site-introduction-links">
            <Link to="/map">{t("nav.map")}</Link>{" · "}
            <Link to="/blog">{t("nav.blog")}</Link>{" · "}
            <Link to="/faq">{t("nav.faq")}</Link>{" · "}
            <Link to="/about">{t("footer.about")}</Link>
          </div>
        </article>
      </div>
    </section>
  );
}
