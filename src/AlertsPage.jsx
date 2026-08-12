import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import useTranslation from "./hooks/useTranslation";
import AuroraAlertsSetup from "./components/AuroraAlertsSetup";
import { isActive } from "./lib/premium";

/* ========================================================================
   AlertsPage — /alerts

   Vakaa, suoraan linkitettävä osoite hälytysasetuksille. Aiemmin asetukset
   olivat vain PremiumSuccessPagen kautta eli ostoputken takana, joten
   AI-avustajalla ei ollut mihin ohjata jo maksanutta käyttäjää.

   Dify-agentin ohjeessa lukee: jos olosuhteet ovat juuri nyt huonot,
   ehdota "[Aseta hälytys](/alerts)" sen sijaan että käyttäjän pitäisi
   palata tarkistamaan tilanne itse. Tämä sivu on sen linkin kohde.

   Jos premium/trial ei ole aktiivinen tällä laitteella, näytetään lyhyt
   selitys ja linkki ostosivulle.
======================================================================= */

export default function AlertsPage() {
  const { t, lang } = useTranslation();
  const fi = lang === "fi";

  /* isActive() luetaan tilaan eikä suoraan renderissä: käyttäjä voi
     aktivoida kokeilun avustajan widgetistä tämän sivun ollessa auki,
     jolloin näkymän pitää vaihtua ilman uudelleenlatausta. */
  const [active, setActive] = useState(() => isActive());

  useEffect(() => {
    const sync = () => setActive(isActive());
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <div>
      <SEO
        title={fi ? "Revontulihälytykset | RepoTracker" : "Aurora Alerts | RepoTracker"}
        description={
          fi
            ? "Aseta henkilökohtaiset revontulihälytykset Telegramiin tai sähköpostiin."
            : "Set up personal aurora alerts via Telegram or email."
        }
        canonical="https://repotracker.fi/alerts"
        language={fi ? "fi" : "en"}
        locale={fi ? "fi_FI" : "en_US"}
      />
      <Header />

      <main
        className="container page-main"
        style={{ maxWidth: 640, margin: "0 auto" }}
      >
        {active ? (
          <AuroraAlertsSetup t={t} />
        ) : (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.6rem",
                marginBottom: 8,
              }}
            >
              {fi
                ? "Revontulihälytykset ovat Premium-ominaisuus"
                : "Aurora Alerts is a Premium feature"}
            </h1>
            <p style={{ color: "var(--fg-muted)", marginBottom: 24 }}>
              {fi
                ? "Aktivoi Premium tai kokeile 6 h ilmaiseksi asettaaksesi hälytykset."
                : "Activate Premium or try 6 hours free to set up alerts."}
            </p>
            <Link to="/premium" className="cta-btn">
              {fi ? "Katso Premium →" : "See Premium →"}
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
