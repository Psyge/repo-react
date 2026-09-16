import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { client } from "../lib/contentfulClient";
import { readPrerenderData, localizedField, fetchAllEntries } from "../lib/prerenderData";
import SEO from "../components/SEO";

export default function BlogPage({ initialEntries }) {
  const [articles, setArticles] = useState(() => initialEntries || readPrerenderData().posts || []);
  const [status, setStatus] = useState("loading");
  const { currentLanguage, t } = useTranslation();
  const locale = currentLanguage === "en" ? "en-US" : "fi-FI";
  useEffect(() => {
    let cancelled = false;
    fetchAllEntries(client, "post").then(items => {
      if (!cancelled) { setArticles(items); setStatus("ready"); }
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);
  return (
    <div>
      <SEO title={`${t("blog.title")} | RepoTracker`} description={t("blog.intro")} canonical="https://repotracker.fi/blog" />
      <Header />
      <main className="container page-main">
        <h1>{t("blog.title")}</h1>
        <p>{t("blog.intro")}</p>
        {!articles.length && <p>{status === "loading" ? t("common.loading") : t("error.fetch")}</p>}
        <div className="articles-grid" style={{ display: "grid", gap: "20px", marginTop: "20px" }}>
          {articles.map(({ sys, fields }) => {
            const slug = localizedField(fields.slug, locale);
            if (!slug) return null;
            return (
              <article key={sys.id} className="article-card" style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
                <h2>{localizedField(fields.title, locale)}</h2>
                <p>{localizedField(fields.excerpt, locale)}</p>
                <Link to={`/blog/${slug}`} style={{ fontWeight: "bold", color: "var(--accent)" }}>{t("blog.read")}</Link>
              </article>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
