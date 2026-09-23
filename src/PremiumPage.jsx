import { useEffect, useState } from "react";
import useTranslation from "./hooks/useTranslation";
import { isActive, read, openCheckout } from "./lib/premium";
import Header from "./components/Header";

import SEO from "./components/SEO";
import Footer from "./components/Footer";

const CONSENT_TEXT_VERSION = "v1";

export default function PremiumPage() {
  const { t, lang, currentLanguage } = useTranslation();
  const fi = (currentLanguage || lang) !== "en";
  const copy = (fiText, enText) => fi ? fiText : enText;

  const [activeDays, setActiveDays] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedTierId, setSelectedTierId] = useState("3d");

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
  const selectedTier = tiers.find((tier) => tier.id === selectedTierId) || tiers[1];

  return (
    <div>
      <SEO
        title="Premium Northern Light Forecast | RepoTracker"
        description="Unlock 72-hour aurora forecasts and advanced northern lights tracking."
        keywords="aurora premium, northern lights forecast"
        canonical="https://repotracker.fi/premium"
      />
      <Header />
      <main className="premium-page rt-premium container page-main">
        <section className="premium-hero rt-premium-hero">
          <span className="rt-premium-kicker">RepoTracker Premium</span>
          <h1>{copy("Enemmän aikaa löytää oikea hetki.", "More time to find the right moment.")}</h1>
          <p className="premium-sub">{copy("Katso pidempi ennuste ja tarkemmat olosuhteet ennen revontuliretkeä. Kertamaksu, valitse tarvitsemasi kesto.", "See a longer forecast and more detailed conditions before your aurora trip. Choose the length you need with a one-time payment.")}</p>
          <span className="rt-premium-pill">{t("premium.footer.oneTime")}</span>
          {activeDays != null && <div className="premium-active">✓ {t("premium.activeBadge")} — {activeDays} {t("premium.daysLeft")}</div>}
          {errorMsg && <div className="premium-error-banner" role="alert">⚠️ {errorMsg}</div>}
        </section>

        <section className="rt-premium-comparison" aria-labelledby="premium-comparison-title">
          <div className="rt-premium-section-head">
            <span className="rt-premium-kicker">{copy("Vertailu", "Comparison")}</span>
            <h2 id="premium-comparison-title">{copy("Mitä lisäarvoa Premium tuo?", "What does Premium add?")}</h2>
          </div>
          <div className="rt-premium-table-wrap">
            <table className="rt-premium-table">
              <thead><tr><th scope="col">{copy("Ominaisuus", "Feature")}</th><th scope="col">{copy("Ilmainen", "Free")}</th><th scope="col">Premium</th></tr></thead>
              <tbody>
                <tr><th scope="row">{copy("Nykyinen Kp, aurinkotuuli ja Bz", "Current Kp, solar wind and Bz")}</th><td>✓</td><td>✓</td></tr>
                <tr><th scope="row">{copy("24 tunnin Kp-ennuste", "24-hour Kp forecast")}</th><td>✓</td><td>✓</td></tr>
                <tr><th scope="row">{copy("3 päivän ennustenäkymä", "3-day forecast view")}</th><td>—</td><td>✓</td></tr>
                <tr><th scope="row">{copy("Tarkempi ennuste ja lisäparametrit", "Detailed forecast and extra parameters")}</th><td>—</td><td>✓</td></tr>
                <tr><th scope="row">{copy("Maapallon pyöritys ja zoomaus", "Globe rotation and zoom")}</th><td>—</td><td>✓</td></tr>
                <tr><th scope="row">{copy("Käyttö enintään 3 laitteella", "Use on up to 3 devices")}</th><td>—</td><td>✓</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="rt-premium-plans" aria-labelledby="premium-plans-title">
          <div className="rt-premium-section-head">
            <span className="rt-premium-kicker">{copy("Kertamaksu", "One-time payment")}</span>
            <h2 id="premium-plans-title">{copy("Valitse retkesi pituus", "Choose the length of your trip")}</h2>
            <p>{copy("Samat ominaisuudet kaikissa paketeissa; vain voimassaoloaika vaihtuu.", "Every plan has the same features; only the duration changes.")}</p>
          </div>
          <div className="rt-premium-plan-grid">
            {tiers.map((tier) => (
              <article key={tier.id} className={`rt-premium-plan${selectedTierId === tier.id ? " is-selected" : ""}`}>
                {tier.featured && <span className="rt-premium-badge">{t("premium.popular")}</span>}
                <h3>{tier.title}</h3>
                <div className="rt-premium-price">{money(tier.price)} €</div>
                <p><strong>{money(tier.price / tier.days)} €</strong> {t("premium.perDay")} · {tier.meta}</p>
                <button type="button" className="rt-premium-select" aria-pressed={selectedTierId === tier.id} onClick={() => setSelectedTierId(tier.id)}>
                  {selectedTierId === tier.id ? copy("Valittu paketti", "Selected plan") : copy("Valitse paketti", "Select plan")}
                </button>
              </article>
            ))}
          </div>

          <div className="rt-premium-checkout">
            <div className="rt-premium-checkout-summary">
              <span className="rt-premium-kicker">{copy("Valinnan yhteenveto", "Your selection")}</span>
              <h3>{selectedTier.title} · {money(selectedTier.price)} €</h3>
              <p>{copy("Premium sisältää 3 päivän ennustenäkymän, tarkemmat tiedot ja maapallon lisätoiminnot. Käyttö enintään kolmella laitteella.", "Premium includes the 3-day forecast view, detailed data and extra globe controls. Use it on up to three devices.")}</p>
              <div className="rt-premium-features">{sharedFeatures.map((feature, i) => <span key={i}>✓ {feature}</span>)}</div>
            </div>
            <div className="rt-premium-checkout-action">
              <label className="rt-premium-consent"><input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} /><span>{t("premium.consent.immediate")}</span></label>
              <label className="rt-premium-consent"><input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} /><span>{t("premium.consent.waiver")}</span></label>
              <button type="button" className="rt-premium-buy" disabled={!consentGiven} title={!consentGiven ? t("premium.consent.required") : undefined} onClick={(e) => handleBuy(e, selectedTier.id)}>{copy("Jatka kassalle", "Continue to checkout")} →</button>
              {!consentGiven && <p className="rt-premium-hint">{t("premium.consent.required")}</p>}
            </div>
          </div>
        </section>

        <div className="rt-premium-legal">
          <p>ℹ️ {t("premium.consent.note")}</p>
          <p>⚠️ {t("premium.consent.disclaimer")}</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
