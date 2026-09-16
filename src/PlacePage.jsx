import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient";
import { readPrerenderData, localizedField, findBySlug, fetchAllEntries } from "./lib/prerenderData";
import places from "./data/places";
import Footer from "./components/Footer";

export default function PlacePage({ initialEntries }) {
  const { slug } = useParams();
  const { t, currentLanguage } = useTranslation();
  const locale = currentLanguage === "en" ? "en-US" : "fi-FI";
  const [entries, setEntries] = useState(() => initialEntries || readPrerenderData().places || []);
  const [status, setStatus] = useState("loading");
  const fields = findBySlug(entries, slug, true)?.fields;
  const localPlace = places.find(p => p.slug === slug);
  useEffect(() => {
    let cancelled = false;
    fetchAllEntries(client, "place").then(items => {
      if (!cancelled) { setEntries(items); setStatus("ready"); }
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);
  if (!fields) {
    return (
      <div>
        <Header />
        {status !== "loading" && <SEO title="Place unavailable | RepoTracker" noIndex />}
        <main className="container page-main">
          <h1>{status === "loading" ? t("common.loading") : currentLanguage === "fi" ? "Paikka ei ole saatavilla" : "Place unavailable"}</h1>
          <Link to="/">{t("places.backHome")}</Link>
        </main>
        <Footer />
      </div>
    );
  }
  const name = localizedField(fields.name, locale) || localizedField(fields.title, locale);
  const short = localizedField(fields.short, locale);
  const description = localizedField(fields.description, locale);
  const number = value => typeof value === "object" && value !== null ? Object.values(value)[0] : value;
  const lat = number(fields.lat) ?? localPlace?.lat;
  const lon = number(fields.lon) ?? localPlace?.lon;
  return (
    <div>
      <SEO title={`${name} – ${currentLanguage === "fi" ? "Revontulien katselu" : "Aurora viewing"} | RepoTracker`}
        description={short || description.slice(0, 160)} canonical={`https://repotracker.fi/places/${slug.toLowerCase()}`} />
      <Header />
      <main className="container article page-main" style={{ maxWidth: "760px" }}>
        <p className="article-back"><Link to="/">← {t("places.backHome")}</Link></p>
        <h1>{name}</h1>
        {short && <p style={{ fontSize: "1.1rem", opacity: 0.75, marginTop: 8 }}>{short}</p>}
        {Number.isFinite(lat) && Number.isFinite(lon) && (
          <Link className="place-map-btn" to={`/map?lat=${lat}&lon=${lon}`}>
            <span aria-hidden="true">🗺</span><span>{t("places.viewAuroraMap")}</span>
          </Link>
        )}
        {description && <div className="article-content" style={{ color: "#fff", lineHeight: 1.7 }}><ReactMarkdown>{description}</ReactMarkdown></div>}
      </main>
      <Footer />
    </div>
  );
}
