import { useParams } from "react-router-dom";

import BlogPost1 from "./pages/BlogPost1";
import BlogPost2 from "./pages/BlogPost2";
import BlogPost3 from "./pages/BlogPost3";

export default function BlogPost() {
  const { slug } = useParams();

  if (slug === "photography") {
    return <BlogPost1 />;
  }

  if (slug === "forecast") {
    return <BlogPost2 />;
  }

  if (slug === "timing") {
    return <BlogPost3 />;
  }

  return (
    
    <div className="container">
      <h1>Article not found</h1>
    </div>
    <footer className="footer">
  <p>© RepoTracker</p>

  <Link to="/privacy">
    {t("footer.privacy")}
  </Link>

  {" - "}

  <Link to="/terms">
    {t("privacy.q.terms")}
  </Link>

  {" - "}

  <Link to="/contact">
    {t("footer.contact") || "Contact"}
  </Link>
</footer>
  );
}