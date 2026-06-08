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

  const currentLang = currentLanguage || "fi";
  const lang = currentLang === "en" ? "en-US" : "fi-FI";

  useEffect(() => {
    setLoading(true);
    
    // Haetaan kaikilla kielillä, jotta haku löytää artikkelin riippumatta siitä, onko osoiterivillä fi- vai en-slug
    client.withAllLocales
      .getEntries({
        content_type: 'post',
        limit: 1
      })
      .then((response) => {
        // Etsitään se artikkeli, jonka slug mätsää joko suomeksi tai englanniksi osoiterivin kanssa
        const found = response.items.find(item => {
          const s = item.fields.slug;
          return s?.['fi-FI'] === slug || s?.['en-US'] === slug;
        });

        if (found) {
          setArticle(found.fields);
        } else {
          setArticle(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Virhe Contentful-haussa:", err);
        setLoading(false);
      });
  }, [slug]);

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

  // Puretaan tekstit valitun kielen mukaan objektista
  const title = article.title?.[lang] || article.title?.['fi-FI'] || "";
  const content = article.content?.[lang] || article.content?.['fi-FI'] || "";
  const description = article.excerpt?.[lang] || article.excerpt?.['fi-FI'] || "RepoTracker Blog";

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

        <div className="article-content" style={{ color: '#fff', marginTop: '20px', lineHeight: '1.6' }}>
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