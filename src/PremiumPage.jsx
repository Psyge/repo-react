import { useEffect, useState } from "react";
import useTranslation from "./hooks/useTranslation";
import { isActive, read, openCheckout } from "./lib/premium";
import Header from "./components/Header";
import { Link } from "react-router-dom";

export default function PremiumPage() {
  const { t, lang } = useTranslation();
  const fi = lang === "fi";

  const [activeDays, setActiveDays] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    document.title = fi
      ? "Aurora Premium — Avaa täysi ennuste"
      : "Aurora Premium — Unlock the full forecast";
  }, [fi]);

  useEffect(() => {
    if (isActive()) {
      const p = read();

      if (p?.expiresAt) {
        const days = Math.max(
          1,
          Math.ceil((p.expiresAt - Date.now()) / 86400000)
        );

        setActiveDays(days);
      }
    } else {
      setActiveDays(null);
    }
  }, [fi]);

  const handleBuy = async (e, tier) => {
    e.preventDefault();

    setErrorMsg("");

    const btn = e.currentTarget;
    const originalText = btn.textContent;

    btn.disabled = true;

    btn.textContent = fi
      ? "Ladataan…"
      : "Loading…";

    try {
      await openCheckout(tier);
    } catch {
      setErrorMsg(
        fi
          ? "Maksun aloitus epäonnistui."
          : "Could not start checkout."
      );
    } finally {
      btn.disabled = false;

      btn.textContent = originalText;
    }
  };

  const tiers = [
    {
      id: "1d",
      title: fi ? "1 päivä" : "1 Day",
      price: "2,99",
      meta: fi
        ? "24 tuntia premiumia"
        : "24 hours premium",
      features: fi
        ? [
            "✓ Täysi ennuste",
            "✓ Pilvisyys & Bz",
            "✓ 3 laitetta",
          ]
        : [
            "✓ Full forecast",
            "✓ Cloud cover & Bz",
            "✓ 3 devices",
          ],
      cta: fi ? "Osta" : "Buy",
      featured: false,
    },
    {
      id: "3d",
      title: fi ? "3 päivää" : "3 Days",
      price: "4,99",
      meta: fi
        ? "Paras revontulireissulle"
        : "Perfect for aurora trips",
      features: fi
        ? [
            "✓ Kaikki ominaisuudet",
            "✓ Usean yön suunnittelu",
            "✓ 3 laitetta",
          ]
        : [
            "✓ All features",
            "✓ Multi-night planning",
            "✓ 3 devices",
          ],
      cta: fi ? "Osta" : "Buy",
      featured: true,
    },
    {
      id: "7d",
      title: fi ? "1 viikko" : "1 Week",
      price: "9,99",
      meta: fi
        ? "Paras arvo"
        : "Best value",
      features: fi
        ? [
            "✓ Kaikki ominaisuudet",
            "✓ Paras hinta/päivä",
            "✓ 3 laitetta",
          ]
        : [
            "✓ All features",
            "✓ Best price/day",
            "✓ 3 devices",
          ],
      cta: fi ? "Osta" : "Buy",
      featured: false,
    },
  ];

  return (
    <div>
          <Header />
    <main className="premium-page container">
      <section className="premium-hero">
        <h1>Aurora Premium</h1>

        <p className="premium-sub">
          {fi
            ? "Avaa täydellinen revontuliennuste kaikkialle maailmassa."
            : "Unlock the complete aurora forecast worldwide."}
        </p>

        {activeDays != null && (
          <div className="premium-active">
            ✓ {fi ? "Premium aktiivinen" : "Premium active"} —
            {" "}
            {activeDays}
            {" "}
            {fi ? "päivää jäljellä" : "days left"}
          </div>
        )}

        {errorMsg && (
          <div className="premium-error">
            {errorMsg}
          </div>
        )}
      </section>

      <section className="pricing-grid">
        {tiers.map((tier) => (
          <article
            key={tier.id}
            className={`pricing-card${
              tier.featured ? " featured" : ""
            }`}
          >
            {tier.featured && (
              <div className="badge">
                {fi ? "Suosituin" : "Popular"}
              </div>
            )}

            <h3>{tier.title}</h3>

            <div className="price">
              <span>{tier.price}</span> €
            </div>

            <p className="meta">
              {tier.meta}
            </p>

            <ul>
              {tier.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>

            <button
              type="button"
              className={`buy-btn${
                tier.featured ? " primary" : ""
              }`}
              onClick={(e) =>
                handleBuy(e, tier.id)
              }
            >
              {tier.cta}
            </button>
          </article>
        ))}
      </section>

      <section className="premium-footer">
        <p>
          {fi
            ? "Kertamaksu · Ei tilausta"
            : "One-time payment · No subscription"}
        </p>

        <p>
          {fi
            ? "Aktivointi jopa 3 laitteelle"
            : "Activate on up to 3 devices"}
        </p>
      </section>
    </main>
    <footer className="footer">
  <p>© RepoTracker</p>

  <Link to="/privacy">
    {t("footer.privacy")}
  </Link>

  {" - "}

  <Link to="/terms">
    {t("privacy.q.terms")}
  </Link>

  {" - "}

  <Link to="/contact">
    {t("footer.contact") || "Contact"}
  </Link>
</footer>
    </div>
  );
}