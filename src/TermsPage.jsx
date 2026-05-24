
import useTranslation from "./hooks/useTranslation";
import { useEffect, useState } from "react";
import Header from "./components/Header";

function EmailLink() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    const user = "info.repotracker";
    const domain = "gmail.com";

    setEmail(`${user}@${domain}`);
  }, []);

  if (!email) return null;

  return (
    <a href={`mailto:${email}`}>
      {email}
    </a>
  );
}

const SECTIONS = [
  {
    q: "terms.q.service",
    body: [
      "terms.a.service1",
      "terms.a.service2",
    ],
  },

  {
    q: "terms.q.payments",
    body: [
      "terms.a.payments1",
      "terms.a.payments2",
    ],
  },

  {
    q: "terms.q.refunds",
    body: [
      "terms.a.refunds1",
      "terms.a.refunds2",
      "terms.a.refunds3",
      "terms.a.refunds4",
    ],
  },

  {
    q: "terms.q.liability",
    body: [
      "terms.a.liability",
    ],
  },

  {
    q: "terms.q.safety",
    body: [
      "terms.a.safety1",
      "terms.a.safety2",
    ],
  },

  {
    q: "terms.q.seller",
    body: [
      "terms.a.seller1",
      "terms.a.seller2",
    ],
  },
];

export default function TermsPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("terms.title")} — RepoTracker`;
  }, [t]);

  return (
    <div>
      <Header />

      <main
        className="container"
        style={{
          padding: "32px 16px",
          maxWidth: 860,
          margin: "0 auto",
        }}
      >
        <section
          className="hero"
          style={{ padding: "24px 0 16px" }}
        >
          <h1>{t("terms.title")}</h1>

          <p className="tagline">
            {t("terms.intro")}
          </p>
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
                background:
                  "rgba(255,255,255,0.04)",
                border:
                  "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "16px 20px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {t(s.q)}
              </h2>

              {s.body.map((k) => (
                <p key={k}>{t(k)}</p>
              ))}

              {s.q === "terms.q.seller" && (
                <p>
                  {t("terms.a.seller3")}{" "}
                  <EmailLink />
                </p>
              )}
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

