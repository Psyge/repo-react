import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import useTranslation from "./hooks/useTranslation";
import SEO from "./components/SEO";

import BlogPost1 from "./pages/BlogPost1";
import BlogPost2 from "./pages/BlogPost2";
import BlogPost3 from "./pages/BlogPost3";

export default function BlogPost() {
  const { slug } = useParams();
  const { t } = useTranslation();

  if (slug === "photography") {
    return <BlogPost1 />;
  }

  if (slug === "forecast") {
    return <BlogPost2 />;
  }

  if (slug === "best-time") {
    return <BlogPost3 />;
  }

  return (
    <div>
      <SEO
  title="Northern Lights Blog"
  description="Aurora guides, photography tips and northern lights forecasting articles."
  canonical="https://repotracker.fi/blog"
/>
      <div className="container">
        <h1>Article not found</h1>

        <p>
          <Link to="/blog">
            Back to blog
          </Link>
        </p>
      </div>

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