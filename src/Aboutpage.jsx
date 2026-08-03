import useTranslation from "./hooks/useTranslation";
import { useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { Link } from "react-router-dom";
import SEO from "./components/SEO";

const SECTIONS = [
  {
    q: "about.q.story",
    body: ["about.a.story1", "about.a.story2"],
  },
  {
    q: "about.q.whatwedo",
    body: ["about.a.whatwedo1"],
  },
  {
    q: "about.q.who",
    body: ["about.a.who1"],
  },
];

export default function AboutPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("about.title")} — RepoTracker`;
  }, [t]);

  return (
    <div>
      <SEO
        title="About Us | RepoTracker"
        description="RepoTracker is a Finnish real-time aurora tracking and forecast site. Read our story and what drives us."
        canonical="https://repotracker.fi/about"
      />
      <Header />

      <main
        className="container"
        style={{
          padding: "32px 16px",
          maxWidth: 860,
          margin: "0 auto",
        }}
      >
        <section className="hero" style={{ padding: "24px 0 16px" }}>
          <h1>{t("about.title")}</h1>
          <p className="tagline">{t("about.intro")}</p>
        </section>

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {SECTIONS.map((s) => (
            <article
              key={s.q}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "16px 20px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>{t(s.q)}</h2>

              {s.body.map((k) => (
                <p key={k}>{t(k)}</p>
              ))}

              {s.q === "about.q.who" && (
                <p style={{ marginTop: 16 }}>
                  <Link to="/contact" style={{ color: "var(--accent)" }}>
                    {t("about.cta.contact")}
                  </Link>
                </p>
              )}
            </article>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}