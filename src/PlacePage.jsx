import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient";
import places from "./data/places";
import Footer from "./components/Footer"

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
        const item = res.items.find((entry) => {
          const s = entry.fields.slug;
          const val = typeof s === "object" && s !== null
            ? Object.values(s)[0]?.toLowerCase()
            : s?.toLowerCase();
          return val === slug;
        });

        if (!item) {
          setNotFound(true);
        } else {
          const f = item.fields;

          // Numerokentät voivat tulla withAllLocales:ssa objektina { "en-US": 66.5 }
          const getNum = (field) => {
            if (field == null) return null;
            if (typeof field === "object") return Object.values(field)[0] ?? null;
            return field;
          };

          setCmsData({
            name:        getField(f.name,        lang),
            short:       getField(f.short,       lang),
            description: getField(f.description, lang),
            lat:         getNum(f.lat),
            lon:         getNum(f.lon),
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

      {/* page-main hoitaa yläreunan tilan headerin korkeudesta laskettuna.
          Tämä luokka oli täällä jo kertaalleen mutta katosi tiedostoa
          kopioitaessa, jolloin otsikko jäi kiinteän headerin alle. */}
      <main
        className="container article page-main"
        style={{ maxWidth: "760px" }}
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

        {/* Karttanappi. Tyylit CSS:ssä eikä inlinenä, jotta kapea näyttö
            voidaan huomioida — inline-tyyleillä ei voi käyttää
            mediakyselyitä, ja nappi rivittyi mobiilissa keskitettynä. */}
        {lat && lon && (
          <button
            type="button"
            className="place-map-btn"
            onClick={() => navigate(`/map?lat=${lat}&lon=${lon}`)}
          >
            <span aria-hidden="true">🗺</span>
            <span>{t("places.viewAuroraMap") || "View aurora conditions on map"}</span>
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

      <Footer />
    </div>
  );
}