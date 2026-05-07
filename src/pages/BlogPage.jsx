import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";

export default function BlogPage() {
  const { t } = useTranslation();

  return (
    <main className="container">
      <h1>{t("blog.title")}</h1>
      <p>{t("blog.intro")}</p>

      <div className="home-articles">

        <Link to="/blog/photography" className="blog-card">
          <div className="blog-card-tag">GUIDE</div>
          <h2>{t("blog.post1.title")}</h2>
          <p>{t("blog.post1.excerpt")}</p>
          <div className="blog-card-read">
            {t("blog.read")}
          </div>
        </Link>

        <Link to="/blog/forecast" className="blog-card">
          <div className="blog-card-tag">GUIDE</div>
          <h2>{t("blog.post2.title")}</h2>
          <p>{t("blog.post2.excerpt")}</p>
          <div className="blog-card-read">
            {t("blog.read")}
          </div>
        </Link>

        <Link to="/blog/best-time" className="blog-card">
          <div className="blog-card-tag">GUIDE</div>
          <h2>{t("blog.post3.title")}</h2>
          <p>{t("blog.post3.excerpt")}</p>
          <div className="blog-card-read">
            {t("blog.read")}
          </div>
        </Link>

      </div>
    </main>
  );
}