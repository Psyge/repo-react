import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useTranslation from '../hooks/useTranslation';
import Header from '../components/Header';
import { client } from '../lib/contentfulClient';

export default function BlogPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentLanguage } = useTranslation();

  useEffect(() => {
    setLoading(true);
    
    const currentLang = currentLanguage || "fi";
    const contentfulLocale = currentLang === "en" ? "en-US" : "fi-FI";

    client.getEntries({
      content_type: 'post',
      limit: 10,
      locale: contentfulLocale // Haetaan suoraan oikealla kielellä
    })
      .then((response) => {
        setArticles(response.items);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Virhe Contentful-haussa:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [currentLanguage]); // Päivittyy kieltä vaihtaessa

  if (loading) return <div className="container"><p>Loading blog...</p></div>;
  if (error) return <div className="container"><p style={{ color: 'red' }}>Error: {error}</p></div>;

  return (
    <div>
      <Header />
      <main className="container" style={{ padding: "var(--space-lg) var(--space-md)" }}>
        {/* KORJATTU: lang vaihdettu muotoon currentLanguage */}
        <h1>{currentLanguage === 'en' ? 'Blog' : 'Blogi'}</h1>
        
        {articles.length === 0 ? (
          <p>No articles found.</p>
        ) : (
          <div className="articles-grid" style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
            {articles.map((article) => {
              const { title, excerpt, slug } = article.fields;

              return (
                <div key={article.sys.id} className="article-card" style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
                  <h2>{title || ""}</h2>
                  <p>{excerpt || ""}</p>
                  
                  <Link to={`/blog/${slug}`} style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                    {currentLanguage === 'en' ? 'Read more' : 'Lue lisää'}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}