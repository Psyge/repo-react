import Header from "../components/Header";
import { Link } from "react-router-dom";
import useTranslation from "../../hooks/useTranslation";

export default function ForecastPost() {
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

        <h1>{t("post2.h1")}</h1>
        <p className="tagline">{t("post2.lead")}</p>

        <h2>{t("post2.h2.kp")}</h2>
        <p>{t("post2.p.kp1")}</p>

        <h2>{t("post2.h2.bz")}</h2>
        <p>{t("post2.p.bz1")}</p>

        <h2>{t("post2.h2.wind")}</h2>
        <p>{t("post2.p.wind1")}</p>

        <h2>{t("post2.h2.ovation")}</h2>
        <p>{t("post2.p.ovation1")}</p>

        <h2>{t("post2.h2.combine")}</h2>
        <ul>
          <li>{t("post2.li.c1")}</li>
          <li>{t("post2.li.c2")}</li>
          <li>{t("post2.li.c3")}</li>
        </ul>

        <p className="article-cta">
          {t("post2.cta")}
        </p>
      </main>

      <footer className="footer">
        <p>© RepoTracker</p>
      </footer>
    </div>
  );
}