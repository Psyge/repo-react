import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient";
import places from "./data/places";

function getField(field, lang) {
  if (!field) return "";
  if (typeof field === "object" && !Array.isArray(field)) {
    return field[lang] || field["fi-FI"] || field["en-US"] || Object.values(field)[0] || "";
  }
  return field;
}

export default function PlacePage() {
  const { slug }    = useParams();
  const navigate    = useNavigate();
  const { t, currentLanguage } = useTranslation();
  const lang = currentLanguage === "en" ? "en-US" : "fi-FI";

  const [cmsData,  setCmsData]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Koordinaatit paikallisesta places.js:stä karttalinkkiä varten
  const localPlace = places.find((p) => p.slug === slug);

  useEffect(() => {
    setLoading(true);
    client.withAllLocales
      .getEntries({ content_type: "place", limit: 50 })
      .then((res) => {
        console.log("Contentful vastaus:", res.items);
        const item = res.items.find((entry) => {
          const s = entry.fields.slug;
          const val = typeof s === "object" ? Object.values(s)[0] : s;
          return val === slug;
        });

        if (!item) {
          setNotFound(true);
        } else {
          setCmsData({
            name:        getField(item.fields.name,        lang),
            short:       getField(item.fields.short,       lang),
            description: getField(item.fields.description, lang),
            lat:         item.fields.lat,
            lon:         item.fields.lon,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("[PlacePage]", err);
        setLoading(false);
        setNotFound(true);
      });
  }, [slug, currentLanguage, lang]);

  if (loading) {
    return (
      <div>
        <Header />
        <div className="container" style={{ padding: "var(--space-lg)" }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <Header />
        <div className="container" style={{ padding: "var(--space-lg)" }}>
          <h1>Place not found</h1>
          <Link to="/">Back to home</Link>
        </div>
      </div>
    );
  }

  const lat = cmsData.lat ?? localPlace?.lat;
  const lon = cmsData.lon ?? localPlace?.lon;

  return (
    <div>
      <SEO
        title={`${cmsData.name} – ${t("places.seoTitle") || "Aurora viewing in Lapland"} | RepoTracker`}
        description={cmsData.short || cmsData.description?.slice(0, 160)}
        canonical={`https://repotracker.fi/places/${slug}`}
      />
      <Header />

      <main
        className="container article"
        style={{ padding: "var(--space-lg) var(--space-md)", maxWidth: "760px" }}
      >
        <p className="article-back">
          <Link to="/">← {t("places.backHome") || "Back"}</Link>
        </p>

        <h1>{cmsData.name}</h1>

        {cmsData.short && (
          <p style={{ fontSize: "1.1rem", opacity: 0.75, marginTop: 8 }}>
            {cmsData.short}
          </p>
        )}

        {/* Karttanappi */}
        {lat && lon && (
          <button
            onClick={() => navigate(`/map?lat=${lat}&lon=${lon}`)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 20,
              marginBottom: 28,
              padding: "10px 20px",
              background: "rgba(0,255,136,0.1)",
              border: "1px solid rgba(0,255,136,0.35)",
              borderRadius: 8,
              color: "#00ff88",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            🗺 {t("places.viewAuroraMap") || "View aurora conditions on map"}
          </button>
        )}

        {/* Pitkä kuvaus Markdownina */}
        {cmsData.description && (
          <div
            className="article-content"
            style={{ color: "#fff", lineHeight: 1.7 }}
          >
            <ReactMarkdown>{cmsData.description}</ReactMarkdown>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>© RepoTracker</p>
        <Link to="/privacy">{t("footer.privacy")}</Link>
        {" - "}
        <Link to="/terms">{t("privacy.q.terms")}</Link>
        {" - "}
        <Link to="/contact">{t("footer.contact") || "Contact"}</Link>
      </footer>
    </div>
  );
}