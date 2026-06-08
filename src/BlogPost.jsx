import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient"; // 1. Haetaan Contentful-asiakas Sanityn sijaan
import ReactMarkdown from 'react-markdown';

export default function BlogPost() {
  const { slug } = useParams();
  const { currentLanguage, t } = useTranslation();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    // 2. Päivitetään haku Contentfulin muotoon.
    // Haetaan se artikkeli, jonka 'fields.slug' vastaa osoiterivin slugia.
    client
      .getEntries({
        content_type: 'post', // Varmista, että Contentfulissa Content Type ID on 'post'
        'fields.slug': slug,
        limit: 1,
        locale: '*'
      })
      .then((response) => {
        if (response.items.length > 0) {
          // Contentful palauttaa datan response.items-listassa. Otetaan sieltä ensimmäinen.
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

  const lang = currentLanguage || "fi";
  
  // 3. Haetaan tekstikentät. Contentfulissa ne ovat suoraan articlen sisällä.
  // Huom: Jos käytät Contentfulin omaa lokalisointia, kentät voivat olla muotoa article.title[lang].
  // Jos taas teit erilliset kentät kummallekin kielelle (esim. titleFi, titleEn), muuta nämä sen mukaan.
  const title = article.title?.[lang] || article.title || "";
  const content = article.content?.[lang] || article.content || "";
  const description = article.excerpt?.[lang] || article.excerpt || "RepoTracker Blog";

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