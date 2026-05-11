import { useEffect, useState } from "react";
import useTranslation from "./hooks/useTranslation";
import { isActive, read, openCheckout } from "./lib/premium";

export default function PremiumPage() {
  const { lang } = useTranslation();
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
        const days = Math.max(1, Math.ceil((p.expiresAt - Date.now()) / 86400000));
        setActiveDays(days);
      } else {
        setActiveDays(null);
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

    btn.setAttribute("aria-disabled", "true");
    btn.textContent = fi ? "Ladataan…" : "Loading…";

    try {
      await openCheckout(tier);
      // Jos openCheckout redirectaa onnistuneesti, tähän ei yleensä palata.
      // Jos ei redirectaa (esim. virhe), palautetaan nappi normaaliksi finallyssa.
    } catch (err) {
      setErrorMsg(
        fi
          ? "Maksun aloitus epäonnistui. Yritä hetken kuluttua uudelleen."
          : "Could not start checkout. Please try again in a moment."
      );
    } finally {
      btn.removeAttribute("aria-disabled");
      btn.textContent = originalText || (fi ? "Osta" : "Buy");
    }
  };

  const tiers = [
    {
      id: "1d",
      title: fi ? "1 päivä" : "1 Day",
      price: "2,99",
      meta: fi ? "24 tuntia täyttä käyttöä" : "24 hours of full access",
      features: fi
        ? ["✓ Täysi ennuste jokaiselle kartan kohteelle", "✓ Pilvisyys & aurinkotuulen tiedot", "✓ Jopa 3 laitetta"]
        : ["✓ Full forecast on every map location", "✓ Cloud cover & solar wind details", "✓ Up to 3 devices"],
      cta: fi ? "Osta 1 päivä" : "Get 1 day",
      featured: false,
    },
    {
      id: "3d",
      title: fi ? "3 päivää" : "3 Days",
      price: "4,99",
      meta: fi ? "Täydellinen revontulireissulle" : "Perfect for an aurora trip",
      features: fi
        ? ["✓ Kaikki mitä 1 päivässä", "✓ Suunnittele useita öitä", "✓ Jopa 3 laitetta"]
        : ["✓ Everything in 1 day", "✓ Plan multiple nights", "✓ Up to 3 devices"],
      cta: fi ? "Osta 3 päivää" : "Get 3 days",
      featured: true,
    },
    {
      id: "7d",
      title: fi ? "1 viikko" : "1 Week",
      price: "9,99",
      meta: fi ? "7 päivää premium-pääsyä" : "7 days of premium access",
      features: fi
        ? ["✓ Kaikki mitä 3 päivässä", "✓ Paras hinta päivää kohden", "✓ Jopa 3 laitetta"]
        : ["✓ Everything in 3 days", "✓ Best value per day", "✓ Up to 3 devices"],
      cta: fi ? "Osta 1 viikko" : "Get 1 week",
      featured: false,
    },
  ];

  return (
    <main className="container" style={{ padding: "48px 16px", maxWidth: 960 }}>
      <section style={{ textAlign: "center", marginBottom: 48 }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 42,
            background: "var(--gradient-aurora)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Aurora Premium
        </h1>

        <p
          style={{
            color: "var(--fg-muted)",
            fontSize: 18,
            marginTop: 12,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {fi
            ? "Avaa täysi ennuste kartalla: todellinen todennäköisyys %, pilvisyys, aurinkotuuli, Bz ja yksityiskohtainen sää mille tahansa kohteelle maailmassa."
            : "Unlock the full forecast on the map: real probability %, cloud cover, solar wind, Bz, and detailed weather for any location worldwide."}
        </p>

        <p style={{ marginTop: 16 }}>
          {activeDays != null && (
            <span style={{ color: "var(--accent)" }}>
              ✓ {fi ? "Premium aktiivinen" : "Premium active"} — {activeDays}{" "}
              {fi ? "pv" : `day${activeDays === 1 ? "" : "s"}`} {fi ? "jäljellä" : "left"}
            </span>
          )}
        </p>

        {errorMsg && (
          <p style={{ marginTop: 10, color: "#ff8a8a", fontSize: 14 }}>
            {errorMsg}
          </p>
        )}
      </section>

      <section className="pricing-grid">
        {tiers.map((tier) => (
          <article key={tier.id} className={`pricing-card${tier.featured ? " featured" : ""}`}>
            {tier.featured && <div className="badge">{fi ? "Suosituin" : "Most popular"}</div>}
            <h3>{tier.title}</h3>
            <div className="price">
              <span>{tier.price}</span> €
            </div>
            <p className="meta">{tier.meta}</p>
            <ul>
              {tier.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>

           <button
  type="button"
  data-buy={tier.id}
  className={`buy-btn${tier.featured ? " primary" : ""}`}
  onClick={(e) => handleBuy(e, tier.id)}
>
  {tier.cta}
</button>
          </article>
        ))}
      </section>

      <section
        style={{
          marginTop: 64,
          color: "var(--fg-muted)",
          fontSize: 14,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        <p>
          {fi
            ? "Kertamaksu · Ei tilausta · Aktivointilinkki sähköpostiisi"
            : "One-time payment · No subscription · Activation link sent to your email"}
        </p>
        <p style={{ marginTop: 8 }}>
          {fi ? "Jokainen osto voidaan aktivoida jopa " : "Each purchase can be activated on up to "}
          <strong>3 {fi ? "laitteella" : "devices"}</strong>.
        </p>
      </section>
    </main>
  );
}