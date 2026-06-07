import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useTranslation from '../hooks/useTranslation'; // Jos käytät täälläkin kielenkääntöä
import Header from '../components/Header';
import { client } from '../lib/contentfulClient';

export default function BlogPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentLanguage, t } = useTranslation();

  useEffect(() => {
    setLoading(true);
    
    // Haetaan kaikki "post"-tyypin sisällöt Contentfulista
    client.getEntries({
      content_type: 'post'
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
              
              // Haetaan kieliversiot (tai suorat kentät, jos et käytä Contentful-lokalisointia)
              const title = fields.title?.[lang] || fields.title || "";
              const excerpt = fields.excerpt?.[lang] || fields.excerpt || "";
              const slug = fields.slug?.[lang] || fields.slug || "";

              return (
                <div key={article.sys.id} className="article-card" style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
                  <h2>{title}</h2>
                  <p>{excerpt}</p>
                  
                  {/* Linkki vie BlogPost-sivulle slug-osoitteen perusteella */}
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
