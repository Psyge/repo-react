import { useEffect } from 'react';
import useTranslation from "./hooks/useTranslation";

export default function PremiumPage() {
  const { t, i18n } = useTranslation();
  const fi = i18n.language === 'fi';

  useEffect(() => {
    document.title = fi
      ? 'Aurora Premium — Avaa täysi ennuste'
      : 'Aurora Premium — Unlock the full forecast';
  }, [fi]);

  useEffect(() => {
    const status = document.getElementById('premium-status');
    if (status && window.AuroraPremium?.isActive()) {
      const p = window.AuroraPremium.read();
      const days = Math.ceil((p.expiresAt - Date.now()) / 86400000);
      status.innerHTML = `<span style="color:var(--accent)">✓ ${
        fi ? 'Premium aktiivinen' : 'Premium active'
      } — ${days} ${fi ? 'pv' : `day${days === 1 ? '' : 's'}`} ${
        fi ? 'jäljellä' : 'left'
      }</span>`;
    }
  }, [fi]);

  const handleBuy = (e, tier) => {
    e.preventDefault();
    const btn = e.currentTarget;
    btn.setAttribute('aria-disabled', 'true');
    btn.textContent = fi ? 'Ladataan…' : 'Loading…';
    window.AuroraPremium?.openCheckout(tier);
  };

  const tiers = [
    {
      id: '1d',
      title: fi ? '1 päivä' : '1 Day',
      price: '2,99',
      meta: fi ? '24 tuntia täyttä käyttöä' : '24 hours of full access',
      features: fi
        ? ['✓ Täysi ennuste jokaiselle kartan kohteelle', '✓ Pilvisyys & aurinkotuulen tiedot', '✓ Jopa 3 laitetta']
        : ['✓ Full forecast on every map location', '✓ Cloud cover & solar wind details', '✓ Up to 3 devices'],
      cta: fi ? 'Osta 1 päivä' : 'Get 1 day',
      featured: false,
    },
    {
      id: '3d',
      title: fi ? '3 päivää' : '3 Days',
      price: '4,99',
      meta: fi ? 'Täydellinen revontulireissulle' : 'Perfect for an aurora trip',
      features: fi
        ? ['✓ Kaikki mitä 1 päivässä', '✓ Suunnittele useita öitä', '✓ Jopa 3 laitetta']
        : ['✓ Everything in 1 day', '✓ Plan multiple nights', '✓ Up to 3 devices'],
      cta: fi ? 'Osta 3 päivää' : 'Get 3 days',
      featured: true,
    },
    {
      id: '7d',
      title: fi ? '1 viikko' : '1 Week',
      price: '9,99',
      meta: fi ? '7 päivää premium-pääsyä' : '7 days of premium access',
      features: fi
        ? ['✓ Kaikki mitä 3 päivässä', '✓ Paras hinta päivää kohden', '✓ Jopa 3 laitetta']
        : ['✓ Everything in 3 days', '✓ Best value per day', '✓ Up to 3 devices'],
      cta: fi ? 'Osta 1 viikko' : 'Get 1 week',
      featured: false,
    },
  ];

  return (
    <main className="container" style={{ padding: '48px 16px', maxWidth: 960 }}>
      <section style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 42,
            background: 'var(--gradient-aurora)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Aurora Premium
        </h1>
        <p
          style={{
            color: 'var(--fg-muted)',
            fontSize: 18,
            marginTop: 12,
            maxWidth: 560,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {fi
            ? 'Avaa täysi ennuste kartalla: todellinen todennäköisyys %, pilvisyys, aurinkotuuli, Bz ja yksityiskohtainen sää mille tahansa kohteelle maailmassa.'
            : 'Unlock the full forecast on the map: real probability %, cloud cover, solar wind, Bz, and detailed weather for any location worldwide.'}
        </p>
        <p id="premium-status" style={{ marginTop: 16 }}></p>
      </section>

      <section className="pricing-grid">
        {tiers.map((tier) => (
          <article key={tier.id} className={`pricing-card${tier.featured ? ' featured' : ''}`}>
            {tier.featured && <div className="badge">{fi ? 'Suosituin' : 'Most popular'}</div>}
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
            <a
              href={`https://report.masto84.workers.dev/api/checkout?tier=${tier.id}`}
              data-buy={tier.id}
              className={`buy-btn${tier.featured ? ' primary' : ''}`}
              onClick={(e) => handleBuy(e, tier.id)}
            >
              {tier.cta}
            </a>
          </article>
        ))}
      </section>

      <section
        style={{
          marginTop: 64,
          color: 'var(--fg-muted)',
          fontSize: 14,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        <p>
          {fi
            ? 'Kertamaksu · Ei tilausta · Aktivointilinkki sähköpostiisi'
            : 'One-time payment · No subscription · Activation link sent to your email'}
        </p>
        <p style={{ marginTop: 8 }}>
          {fi ? 'Jokainen osto voidaan aktivoida jopa ' : 'Each purchase can be activated on up to '}
          <strong>3 {fi ? 'laitteella' : 'devices'}</strong>.
        </p>
      </section>
    </main>
  );
}
