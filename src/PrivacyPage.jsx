import useTranslation from "./hooks/useTranslation";
import { useEffect } from 'react';
import Header from "./components/Header";

const SECTIONS = [
  { q: 'privacy.q.about', body: ['privacy.a.about1', 'privacy.a.about2'] },
  {
    q: 'privacy.q.data',
    body: ['privacy.a.data1'],
    list: ['privacy.a.data2', 'privacy.a.data3', 'privacy.a.data4'],
    after: ['privacy.a.data5'],
  },
  { q: 'privacy.q.ads', body: ['privacy.a.ads1', 'privacy.a.ads2', 'privacy.a.ads3'] },
  { q: 'privacy.q.cookies', body: ['privacy.a.cookies'] },
  { q: 'privacy.q.contact', body: ['privacy.a.contact'] },
];

export default function PrivacyPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('privacy.pagetitle');
  }, [t]);

  return (
    <div>
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
    </div>
  );
}
