import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient";
import { readPrerenderData, localizedField, findBySlug, fetchAllEntries } from "./lib/prerenderData";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Footer from "./components/Footer";

export default function BlogPost({ initialEntries }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { currentLanguage, t } = useTranslation();
  const [entries, setEntries] = useState(() => initialEntries || readPrerenderData().posts || []);
  const [status, setStatus] = useState("loading");
  const foundFields = findBySlug(entries, slug)?.fields;
  const article = foundFields?.content ? foundFields : null;
  const locale = currentLanguage === "en" ? "en-US" : "fi-FI";
  const fi = currentLanguage === "fi";
  useEffect(() => {
    let cancelled = false;
    fetchAllEntries(client, "post").then(items => {
      if (!cancelled) { setEntries(items); setStatus("ready"); }
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);
  const localizedSlug = article ? localizedField(article.slug, locale) : "";
  useEffect(() => {
    if (localizedSlug && localizedSlug !== slug) navigate(`/blog/${localizedSlug}`, { replace: true });
  }, [localizedSlug, slug, navigate]);
  if (!article) {
    return (
      <div>
        <Header />
        {status !== "loading" && <SEO title={fi ? "Artikkelia ei löytynyt | RepoTracker" : "Article unavailable | RepoTracker"} noIndex />}
        <main className="container page-main">
          <h1>{status === "loading" ? t("common.loading") : fi ? "Artikkeli ei ole saatavilla" : "Article unavailable"}</h1>
          <p><Link to="/blog">{t("blog.back")}</Link></p>
        </main>
        <Footer />
      </div>
    );
  }
  const title = localizedField(article.title, locale);
  const description = localizedField(article.excerpt, locale) || "RepoTracker Blog";
  const content = localizedField(article.content, locale);
  const alternates = typeof article.slug === "object" ? Object.entries(article.slug)
    .filter(([, value]) => value).map(([lang, value]) => ({ language: lang === "fi-FI" ? "fi" : "en", href: `https://repotracker.fi/blog/${value}` })) : [];
  return (
    <div>
      <SEO title={`${title} | RepoTracker`} description={description}
        canonical={`https://repotracker.fi/blog/${localizedSlug || slug}`}
        language={currentLanguage} locale={fi ? "fi_FI" : "en_US"} type="article" alternates={alternates} />
      <Header />
      <main className="container article page-main" style={{ maxWidth: "760px" }}>
        <p className="article-back"><Link to="/blog">{t("blog.back")}</Link></p>
        <h1>{title}</h1>
        <div className="article-content" style={{ color: "#fff", marginTop: "20px", lineHeight: "1.6" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </main>
      <Footer />
    </div>
  );
}
