import { Link } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";

/* ========================================================================
   Footer — jaettu kaikille sivuille.
   - Perusversio: © RepoTracker + Privacy/Terms/About/Contact-linkit
   - showCoop: näyttää lisäksi yhteistyö-osion (vain etusivulla käytössä
     alun perin) — muilla sivuilla jätetään pois oletuksena.

   Käyttö:
     <Footer />              // tavallinen sivu (Terms, About, jne.)
     <Footer showCoop />     // etusivu, coop-osion kanssa
======================================================================= */

export default function Footer({ showCoop = false }) {
  const { t } = useTranslation();

  if (showCoop) {
    return (
      <footer className="footer">
        {/* 1. Yhteistyöosio siististi ylhäällä */}
        <div className="footer-coop" style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <p className="footer-coop-title" style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
            🤝 {t("coop_title")}
          </p>
          <p className="footer-coop-text">
            {t("coop_text")}{" "}
            <Link
              to="/contact"
              className="footer-coop-link"
              style={{ color: "#00ffc6", textDecoration: "underline" }}
            >
              {t("footer.contact") || "Contact"}
            </Link>
          </p>
        </div>

        {/* 2. Lakilinkit ja copyright omalla rivillään aivan alhaalla */}
        <div className="footer-bottom" style={{ textAlign: "center", opacity: 0.6, fontSize: "0.9rem" }}>
          <p style={{ marginBottom: "0.5rem" }}>© RepoTracker</p>
          <div className="footer-links">
            <Link to="/privacy">{t("footer.privacy")}</Link>
            {" - "}
            <Link to="/terms">{t("privacy.q.terms")}</Link>
            {" - "}
            <Link to="/about">{t("footer.about")}</Link>
            {" - "}
            <Link to="/contact">{t("footer.contact") || "Contact"}</Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="footer">
      <p>© RepoTracker</p>

      <Link to="/privacy">{t("footer.privacy")}</Link>

      {" - "}

      <Link to="/terms">{t("privacy.q.terms")}</Link>

      {" - "}

      <Link to="/about">{t("footer.about")}</Link>

      {" - "}

      <Link to="/contact">{t("footer.contact") || "Contact"}</Link>
    </footer>
  );
}