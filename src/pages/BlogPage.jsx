import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import Header from "../components/Header";
import { client } from "../lib/contentfulClient";
import SEO from "../components/SEO";

export default function BlogPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const { currentLanguage }     = useTranslation();

  const lang           = currentLanguage === "en" ? "en-US" : "fi-FI";
  const contentfulLang = lang; // sama muoto Contentfulille

  useEffect(() => {
    setLoading(true);
    setError(null);

    // withAllLocales jotta slug on aina saatavilla oikean kielen muodossa
    // listanäkymässä, ja voidaan rakentaa oikea linkki
    client.withAllLocales
      .getEntries({
        content_type: "post",
        limit: 20,
      })
      .then((response) => {
        setArticles(response.items);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Contentful error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [currentLanguage]); // päivittyy kieltä vaihtaessa

  // Apufunktio: purkaa lokalisoitu kenttä tai palaa suoraan stringiin
  function getField(field) {
    if (!field) return "";
    if (typeof field === "object" && !Array.isArray(field)) {
      return field[contentfulLang] || field["fi-FI"] || "";
    }
    return field;
  }

  if (loading) {
    return (
      <div>
        <Header />
        <div className="container">
          <p>Loading blog...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header />
        <div className="container">
          <p style={{ color: "red" }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  const fi = currentLanguage !== "en";

  return (
    <div>
      {/* Artikkelilistalta puuttui SEO kokonaan: sivu oli sitemapissa mutta
          sai otsikokseen index.html:n oletuksen eikä kertonut itsestään
          mitään hakukoneelle. */}
      <SEO
        title={
          fi
            ? "Revontuliartikkelit ja oppaat | RepoTracker"
            : "Northern Lights Articles and Guides | RepoTracker"
        }
        description={
          fi
            ? "Oppaat revontulien katseluun Lapissa: paras aika, kuvausvinkit, Kp-indeksin lukeminen ja varustautuminen."
            : "Guides for seeing the northern lights in Lapland: best time to go, photography tips, reading the Kp index and what to wear."
        }
        keywords={
          fi
            ? "revontulet, revontuliopas, revontulien kuvaus, Kp-indeksi, Lappi"
            : "northern lights guide, aurora photography, Kp index, Lapland"
        }
        canonical="https://repotracker.fi/blog"
        language={fi ? "fi" : "en"}
        locale={fi ? "fi_FI" : "en_US"}
      />
      <Header />
      <main className="container page-main">
        <h1>{currentLanguage === "en" ? "Blog" : "Blogi"}</h1>

        {articles.length === 0 ? (
          <p>No articles found.</p>
        ) : (
          <div
            className="articles-grid"
            style={{ display: "grid", gap: "20px", marginTop: "20px" }}
          >
            {articles.map((article) => {
              const title   = getField(article.fields.title);
              const excerpt = getField(article.fields.excerpt);

              // Slug: käytä nykyisen kielen slugia jos saatavilla,
              // fallback fi-FI jotta linkki ei hajoa
              const slugField = article.fields.slug;
              const slug =
                typeof slugField === "object"
                  ? slugField[contentfulLang] || slugField["fi-FI"] || ""
                  : slugField || "";

              return (
                <div
                  key={article.sys.id}
                  className="article-card"
                  style={{
                    border: "1px solid #ccc",
                    padding: "20px",
                    borderRadius: "8px",
                  }}
                >
                  <h2>{title}</h2>
                  <p>{excerpt}</p>
                  <Link
                    to={`/blog/${slug}`}
                    style={{
                      fontWeight: "bold",
                      color: "var(--color-primary)",
                    }}
                  >
                    {currentLanguage === "en" ? "Read more" : "Lue lisää"}
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