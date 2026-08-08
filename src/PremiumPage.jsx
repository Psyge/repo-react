import { useEffect, useState } from "react";
import useTranslation from "./hooks/useTranslation";
import { isActive, read, openCheckout } from "./lib/premium";
import Header from "./components/Header";
import { Link } from "react-router-dom";
import SEO from "./components/SEO";

const CONSENT_TEXT_VERSION = "v1";

export default function PremiumPage() {
  const { t, lang } = useTranslation();

  const [activeDays, setActiveDays] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [immediate, setImmediate] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const consentGiven = immediate && waiver;

  useEffect(() => {
    document.title = t("premium.pagetitle");
  }, [t, lang]);

  useEffect(() => {
    if (isActive()) {
      const p = read();
      if (p?.expiresAt) {
        const days = Math.max(1, Math.ceil((p.expiresAt - Date.now()) / 86400000));
        setActiveDays(days);
      }
    } else {
      setActiveDays(null);
    }
  }, [lang]);

  const handleBuy = async (e, tier) => {
    e.preventDefault();
    setErrorMsg("");

    if (!consentGiven) {
      setErrorMsg(t("premium.consent.required"));
      return;
    }

    const btn = e.currentTarget;
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.textContent = t("common.loading");

    try {
      await openCheckout(tier, {
        immediateDelivery: immediate,
        waiveWithdrawal: waiver,
        textVersion: CONSENT_TEXT_VERSION,
      });
    } catch {
      setErrorMsg(t("premium.error"));
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };

  /* Paketit erosivat toisistaan VAIN kestossa ja hinnassa — kolmen kohdan
   * ✓-listat olivat käytännössä identtiset ("3 laitetta" toistui kaikissa,
   * "Täysi ennuste" ja "Kaikki ominaisuudet" tarkoittavat samaa). Kolme
   * kertaa toistettu sama lista vei mobiilissa koko ruudun kertomatta mikä
   * pakettien ero on.
   *
   * Nyt yhteiset ominaisuudet ovat omassa laatikossaan kerran, ja korteissa
   * on vain se mikä oikeasti eroaa: kesto, hinta ja päivähinta. Päivähinta
   * tekee vertailun mahdolliseksi — 2,99 € vs. 9,99 € ei kerro kumpi
   * kannattaa, 2,99 €/pv vs. 1,43 €/pv kertoo. */
  const tiers = [
    { id: "1d", title: t("premium.tier.1d.title"), price: 2.99, days: 1, meta: t("premium.tier.1d.meta"), featured: false },
    { id: "3d", title: t("premium.tier.3d.title"), price: 4.99, days: 3, meta: t("premium.tier.3d.meta"), featured: true },
    { id: "7d", title: t("premium.tier.7d.title"), price: 9.99, days: 7, meta: t("premium.tier.7d.meta"), featured: false },
  ];

  // Suomalainen desimaalipilkku molemmilla kielillä — hinta on euroissa
  const money = (n) => n.toFixed(2).replace(".", ",");

  const sharedFeatures = [
    t("premium.included.f1"),
    t("premium.included.f2"),
    t("premium.included.f3"),
  ];

  return (
    <div>
      <SEO
        title="Premium Northern Light Forecast | RepoTracker"
        description="Unlock 72-hour aurora forecasts and advanced northern lights tracking."
        keywords="aurora premium, northern lights forecast"
        canonical="https://repotracker.fi/premium"
      />
      <Header />
      <main className="premium-page container page-main">
        
        <section className="premium-hero">
          <h1>Northern Lights Premium</h1>
          <p className="premium-sub">{t("premium.sub")}</p>

          {activeDays != null && (
            <div className="premium-active">
              ✓ {t("premium.activeBadge")} — {activeDays} {t("premium.daysLeft")}
            </div>
          )}

          {errorMsg && (
            <div className="premium-error-banner">
              ⚠️ {errorMsg}
            </div>
          )}
        </section>

        {/* Yhteiset ominaisuudet kerran, ennen paketteja */}
        <section className="premium-included">
          <h2>{t("premium.included.title")}</h2>
          <ul>
            {sharedFeatures.map((f, i) => <li key={i}>✓ {f}</li>)}
          </ul>
        </section>

        {/* 1. LAATIKOT ENSIN */}
        <section className="pricing-grid">
          {tiers.map((tier) => (
            <article key={tier.id} className={`pricing-card${tier.featured ? " featured" : ""}`}>
              {tier.featured && <div className="badge">{t("premium.popular")}</div>}
              <h3>{tier.title}</h3>
              <div className="price"><span>{money(tier.price)}</span> €</div>
              <p className="meta">
                <strong>{money(tier.price / tier.days)} €</strong> {t("premium.perDay")}
                {tier.meta ? ` · ${tier.meta}` : ""}
              </p>
              <button
                type="button"
                className={`buy-btn ${tier.featured ? "primary" : ""} ${!consentGiven ? "is-locked" : ""}`}
                disabled={!consentGiven}
                title={!consentGiven ? t("premium.consent.required") : undefined}
                onClick={(e) => handleBuy(e, tier.id)}
              >
                {!consentGiven ? "🔒 " : ""}{t("premium.cta")}
              </button>
            </article>
          ))}
        </section>

        {/* 2. SUOSTUMUKSET NYT LAATIKOIDEN ALLA KESKITETTYNÄ */}
        <section className={`premium-consent-box ${consentGiven ? "is-approved" : ""}`}>
          <div className="consent-inner">
            <label className="premium-consent-row">
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={immediate}
                  onChange={(e) => setImmediate(e.target.checked)}
                />
                <span className="custom-checkbox" />
              </div>
              <span className="consent-text">{t("premium.consent.immediate")}</span>
            </label>

            <label className="premium-consent-row">
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={waiver}
                  onChange={(e) => setWaiver(e.target.checked)}
                />
                <span className="custom-checkbox" />
              </div>
              <span className="consent-text">{t("premium.consent.waiver")}</span>
            </label>

            <p className="premium-consent-note">
              ℹ️ {t("premium.consent.note")}
            </p>
            <p className="premium-consent-disclaimer">
      ⚠️ {t("premium.consent.disclaimer")}
    </p>
          </div>
        </section>

        <section className="premium-footer">
          <p>{t("premium.footer.oneTime")}</p>
          <p>{t("premium.footer.devices")}</p>
        </section>
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