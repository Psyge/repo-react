import { Link } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import useTranslation from "./hooks/useTranslation";

/* ========================================================================
   NotFoundPage — catch-all (path="*")

   App.js:ssä ei ollut varareittiä lainkaan, joten tuntematon osoite
   renderöi tyhjän valkoisen sivun: ei otsikkoa, ei paluulinkkiä, ei
   mitään vihjettä siitä mitä tapahtui.

   Tämä on nyt aiempaa tärkeämpää, koska AI-avustaja jakaa vastauksissaan
   linkkejä. Linkkien polut tarkistetaan jo lib/routes.js:ää vasten, mutta
   varareitti tarvitaan silti: vanhentuneet linkit, kirjoitusvirheet
   osoiterivillä ja hakukoneiden indeksoimat poistetut sivut päätyvät
   tänne.
======================================================================= */

export default function NotFoundPage() {
  const { lang } = useTranslation();
  const fi = lang === "fi";

  return (
    <div>
      <SEO
        title={fi ? "Sivua ei löytynyt | RepoTracker" : "Page not found | RepoTracker"}
        description={
          fi
            ? "Etsimääsi sivua ei löytynyt."
            : "The page you were looking for could not be found."
        }
        language={fi ? "fi" : "en"}
        locale={fi ? "fi_FI" : "en_US"}
        /* Ei indeksoida: virhesivut eivät kuulu hakutuloksiin */
        noIndex
      />
      <Header />

      <main
        className="container page-main"
        style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>🧭</div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.8rem",
            marginBottom: 10,
          }}
        >
          {fi ? "Sivua ei löytynyt" : "Page not found"}
        </h1>

        <p style={{ color: "var(--fg-muted)", marginBottom: 28 }}>
          {fi
            ? "Osoite saattaa olla vanhentunut tai kirjoitettu väärin."
            : "The address may be outdated or mistyped."}
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link to="/" className="cta-btn">
            {fi ? "Etusivulle" : "Go home"}
          </Link>
          <Link to="/map" className="aurora-alerts-btn-secondary">
            {fi ? "Avaa kartta" : "Open the map"}
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
