import Header from "../components/Header";
import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";

export default function BlogPost3() {
  const { t } = useTranslation();

  return (
    <div>
      <Header />

      <main
        className="container article"
        style={{
          padding: "var(--space-lg) var(--space-md)",
          maxWidth: "760px",
        }}
      >
        {/* BACK */}
        <p className="article-back">
          <Link to="/blog">{t("blog.back")}</Link>
        </p>

        {/* TITLE */}
        <h1>{t("post3.h1")}</h1>
        <p className="tagline">{t("post3.lead")}</p>

        {/* SECTION 1 */}
        <h2>{t("post3.h2.season")}</h2>
        <p>{t("post3.p.season1")}</p>

        {/* SECTION 2 */}
        <h2>{t("post3.h2.peaks")}</h2>
        <ul>
          <li>{t("post3.li.m1")}</li>
          <li>{t("post3.li.m2")}</li>
          <li>{t("post3.li.m3")}</li>
        </ul>

        {/* SECTION 3 */}
        <h2>{t("post3.h2.hours")}</h2>
        <p>{t("post3.p.hours1")}</p>

        {/* SECTION 4 */}
        <h2>{t("post3.h2.moon")}</h2>
        <p>{t("post3.p.moon1")}</p>

        {/* SECTION 5 */}
        <h2>{t("post3.h2.cycle")}</h2>
        <p>{t("post3.p.cycle1")}</p>

        {/* CTA */}
        <p className="article-cta">
          {t("post3.cta")}
        </p>
      </main>

     <footer className="footer">
        <p>© RepoTracker</p>

        <Link to="/privacy">
          {t("footer.privacy")}
        </Link>

        {" - "}

        <Link to="/terms">
          {t("footer.terms")}
        </Link>

        {" - "}

        <Link to="/contact">
          {t("footer.contact")}
        </Link>
      </footer>
    </div>
  );
}