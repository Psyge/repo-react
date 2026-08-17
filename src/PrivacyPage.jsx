import useTranslation from "./hooks/useTranslation";
import { useEffect } from 'react';
import Header from "./components/Header";
import Footer from "./components/Footer"

import SEO from "./components/SEO";

const SECTIONS = [
  {
    q: 'privacy.q.about',
    body: [
      'privacy.a.about1',
      'privacy.a.about2'
    ]
  },

  {
    q: 'privacy.q.data',
    body: ['privacy.a.data1'],
    list: [
      'privacy.a.data2',
      'privacy.a.data3',
      'privacy.a.data4'
    ],
    after: ['privacy.a.data5']
  },

  /* Sijaintitiedot ja havainnot. Tämä osio lisättiin kun kalibraatioloki
     otettiin käyttöön: käyttäjän lähettämä sijainti on henkilötietoa, ja
     sen kerääminen pitää kertoa vaikka se olisi karkeistettu. */
  {
    q: 'privacy.q.location',
    body: ['privacy.a.location1'],
    list: [
      'privacy.a.location2',
      'privacy.a.location3',
      'privacy.a.location4'
    ],
    after: ['privacy.a.location5', 'privacy.a.location6']
  },

  {
    q: 'privacy.q.email',
    body: [
      'privacy.a.email1',
      'privacy.a.email2',
      'privacy.a.email3'
    ]
  },

  {
    q: 'privacy.q.ads',
    body: [
      'privacy.a.ads1',
      'privacy.a.ads2',
      'privacy.a.ads3'
    ]
  },

  {
    q: 'privacy.q.cookies',
    body: [
      'privacy.a.cookies1',
      'privacy.a.cookies2'
    ]
  },

  {
    q: 'privacy.q.retention',
    body: [
      'privacy.a.retention1'
    ]
  },

  {
    q: 'privacy.q.rights',
    body: [
      'privacy.a.rights1',
      'privacy.a.rights2',
      'privacy.a.rights3',
      'privacy.a.rights4'
    ]
  },
  {
    q: 'privacy.q.security',
    body: [
      'privacy.a.security1',
      'privacy.a.security2',
      'privacy.a.security3',
      'privacy.a.security4'
    ]
  },
  {
    q: 'privacy.q.controller',
    body: [
      'privacy.a.controller1',
      'privacy.a.controller2'
    ]
  },

  {
    q: 'privacy.q.contact',
    body: [
      'privacy.a.contact'
    ]
  }
];

export default function PrivacyPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('privacy.pagetitle');
  }, [t]);

  return (
    <div>
      <SEO
  title="Privacy Policy | RepoTracker"
  description="Privacy Policy for RepoTracker and information about data processing, cookies and user privacy."
  canonical="https://repotracker.fi/privacy"
/>
      <Header />
    <main className="container" style={{ padding: '32px 16px', maxWidth: 860, margin: '0 auto' }}>
      <section className="hero" style={{ padding: '24px 0 16px' }}>
        <h1>{t('privacy.title')}</h1>
        <p className="tagline">{t('privacy.intro')}</p>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {SECTIONS.map((s) => (
          <article
            key={s.q}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '16px 20px',
            }}
          >
            <h2 style={{ marginTop: 0 }}>{t(s.q)}</h2>
            {s.body.map((k) => <p key={k}>{t(k)}</p>)}
            {s.list && (
              <ul style={{ paddingLeft: 22 }}>
                {s.list.map((k) => <li key={k}>{t(k)}</li>)}
              </ul>
            )}
            {s.after && s.after.map((k) => <p key={k}>{t(k)}</p>)}
          </article>
        ))}
      </section>
    </main>
    
<Footer />
    </div>
  );
}