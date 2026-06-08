import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient";
import ReactMarkdown from 'react-markdown';

export default function BlogPost() {
  const { slug } = useParams();
  const { currentLanguage, t } = useTranslation();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. MÄÄRITELLÄÄN KIELET FUNKTION ALUSSA
  // Muutetaan lyhyt kieli (fi/en) Contentfulin ymmärtämään muotoon (fi-FI/en-US)
  const currentLang = currentLanguage || "fi";
  const lang = currentLang === "en" ? "en-US" : "fi-FI";

  useEffect(() => {
    setLoading(true);
    
    client.withAllLocales
      .getEntries({
        content_type: 'post',
        // Etsitään slugia juuri sen kielen alta, mikä sivustolla on valittuna
        [`fields.slug.${lang}`]: slug, 
        limit: 1
      })
      .then((response) => {
        if (response.items.length > 0) {
          setArticle(response.items[0].fields);
        } else {
          setArticle(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Virhe Contentful-haussa:", err);
        setLoading(false);
      });
  }, [slug, lang]); // Lisätty lang tänne riippuvuuksiin, jotta haku päivittyy jos kieltä lennosta vaihdetaan

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
        <div className="container" style={{ padding: "var(--space-lg) var(--space-md)" }}>
          <h1>Article not found</h1>
          <p><Link to="/blog">Back to blog</Link></p>
        </div>
      </div>
    );
  }

  // 2. HAETAAN TEKSTIKENTÄT KIELLÄ (lang on nyt "fi-FI" tai "en-US")
  const title = article.title?.[lang] || (typeof article.title === 'string' ? article.title : "");
  const content = article.content?.[lang] || (typeof article.content === 'string' ? article.content : "");
  const description = article.excerpt?.[lang] || (typeof article.excerpt === 'string' ? article.excerpt : "RepoTracker Blog");

  return (
    <div>
      <SEO 
        title={`${title} - RepoTracker Blog`} 
        description={description}
        canonical={`https://repotracker.fi/blog/${slug}`}
      />
      <Header />

      <main className="container article" style={{ padding: "var(--space-lg) var(--space-md)", maxWidth: "760px" }}>
        <p className="article-back">
          <Link to="/blog">{t("blog.back")}</Link>
        </p>

        <h1>{title}</h1>

        <div className="article-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </main>

      <footer className="footer">
        <p>© RepoTracker</p>
        <Link to="/privacy">{t("footer.privacy")}</Link> {" - "}
        <Link to="/terms">{t("footer.terms")}</Link> {" - "}
        <Link to="/contact">{t("footer.contact")}</Link>
      </footer>
    </div>
  );
}