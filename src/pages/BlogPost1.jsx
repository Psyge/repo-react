import Header from "../components/Header";
import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";

export default function BlogPost1() {
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
        <p className="article-back">
          <Link to="/blog">{t("blog.back")}</Link>
        </p>

        <h1>{t("post1.h1")}</h1>
        <p className="tagline">{t("post1.lead")}</p>

        <h2>{t("post1.h2.gear")}</h2>
        <p>{t("post1.p.gear1")}</p>

        <ul>
          <li>{t("post1.li.gear1")}</li>
          <li>{t("post1.li.gear2")}</li>
          <li>{t("post1.li.gear3")}</li>
          <li>{t("post1.li.gear4")}</li>
        </ul>

        <h2>{t("post1.h2.settings")}</h2>
        <p>{t("post1.p.settings1")}</p>

        <ul>
          <li>{t("post1.li.set1")}</li>
          <li>{t("post1.li.set2")}</li>
          <li>{t("post1.li.set3")}</li>
          <li>{t("post1.li.set4")}</li>
          <li>{t("post1.li.set5")}</li>
          <li>{t("post1.li.set6")}</li>
          <li>{t("post1.li.set7")}</li>
        </ul>

        <h2>{t("post1.h2.phone")}</h2>
        <p>{t("post1.p.phone1")}</p>

        <h2>{t("post1.h2.composition")}</h2>
        <ul>
          <li>{t("post1.li.comp1")}</li>
          <li>{t("post1.li.comp2")}</li>
          <li>{t("post1.li.comp3")}</li>
          <li>{t("post1.li.comp4")}</li>
        </ul>

        <h2>{t("post1.h2.field")}</h2>
        <p>{t("post1.p.field1")}</p>

        <h2>{t("post1.h2.safety")}</h2>
        <p>{t("post1.p.safety1")}</p>

        <p className="article-cta">
          {t("post1.cta")} <Link to="/">{t("map.open")}</Link>
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