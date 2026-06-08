import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient";
import ReactMarkdown from "react-markdown";
import remarkGfm from 'remark-gfm';

export default function BlogPost() {
  const { slug } = useParams();
  const { currentLanguage, t } = useTranslation();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  const lang = currentLanguage === "en" ? "en-US" : "fi-FI";

  useEffect(() => {
    setLoading(true);

    // Haetaan withAllLocales jotta molemmat kielet saatavilla
    // ja reagoidaan sekä slug- että kielimuutoksiin
    client.withAllLocales
      .getEntries({
        content_type: "post",
        limit: 100,
      })
      .then((response) => {
        const found = response.items.find((item) => {
          const s = item.fields.slug;
          // slug voi tulla joko lokalisoituna objektina tai suorana stringinä
          if (typeof s === "object") {
            return s?.["fi-FI"] === slug || s?.["en-US"] === slug;
          }
          return s === slug;
        });

        setArticle(found?.fields ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Contentful error:", err);
        setLoading(false);
      });
  }, [slug, currentLanguage]); // ← reagoi myös kielen vaihtoon

  if (loading) {
    return (
      <div className="container" style={{ padding: "var(--space-lg)" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div>
        <Header />
        <div
          className="container"
          style={{ padding: "var(--space-lg) var(--space-md)" }}
        >
          <h1>Article not found</h1>
          <p>
            <Link to="/blog">Back to blog</Link>
          </p>
        </div>
      </div>
    );
  }

  // Puretaan oikea kieli — toimii sekä objektimuodossa { 'fi-FI': '...' }
  // että suorana stringinä (jos Contentful palauttaa jo lokalisoituna)
  function getField(field) {
    if (!field) return "";
    if (typeof field === "object" && !Array.isArray(field)) {
      return field[lang] || field["fi-FI"] || "";
    }
    return field;
  }

  const title       = getField(article.title);
  const content     = getField(article.content);
  const description = getField(article.excerpt) || "RepoTracker Blog";

  return (
    <div>
      <SEO
        title={`${title} - RepoTracker Blog`}
        description={description}
        canonical={`https://repotracker.fi/blog/${slug}`}
      />
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

        <h1>{title}</h1>

        <div
          className="article-content"
          style={{ color: "#fff", marginTop: "20px", lineHeight: "1.6" }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </main>

      <footer className="footer">
        <p>© RepoTracker</p>
        <Link to="/privacy">{t("footer.privacy")}</Link>
        {" - "}
        <Link to="/terms">{t("footer.terms")}</Link>
        {" - "}
        <Link to="/contact">{t("footer.contact")}</Link>
      </footer>
    </div>
  );
}