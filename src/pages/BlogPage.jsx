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
    
    // 1. KÄYTETÄÄN UUTTA .withAllLocales JA POISTETTIIN locale: '*'
    // Nostettu samalla limit 10:een, jotta kaikki artikkelit näkyvät listassa
    client.withAllLocales.getEntries({
      content_type: 'post',
      limit: 10 
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
  }, []);

  if (loading) return <div className="container"><p>Loading blog...</p></div>;
  if (error) return <div className="container"><p style={{ color: 'red' }}>Error: {error}</p></div>;

  const lang = currentLanguage || "fi";

  return (
    <div>
      <Header />
      <main className="container" style={{ padding: "var(--space-lg) var(--space-md)" }}>
        <h1>{lang === 'fi' ? 'Blogi' : 'Blog'}</h1>
        
        {articles.length === 0 ? (
          <p>No articles found.</p>
        ) : (
          <div className="articles-grid" style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
            {articles.map((article) => {
              const fields = article.fields;
              
              // Nyt nämä kielivalinnat toimivat täydellisesti, kun .withAllLocales on päällä
              const title = fields.title?.[lang] || fields.title || "";
              const excerpt = fields.excerpt?.[lang] || fields.excerpt || "";
              const slug = fields.slug?.[lang] || fields.slug || "";

              return (
                <div key={article.sys.id} className="article-card" style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
                  <h2>{title}</h2>
                  <p>{excerpt}</p>
                  
                  <Link to={`/blog/${slug}`} style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                    {lang === 'fi' ? 'Lue lisää' : 'Read more'}
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