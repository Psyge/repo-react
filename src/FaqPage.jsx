import useTranslation from "./hooks/useTranslation";
import Header from "./components/Header";
import { useEffect } from 'react';

const QUESTIONS = [
  { q: 'faq.q.about', body: ['faq.a.about1', 'faq.a.about2', 'faq.a.about3'] },
  { q: 'faq.q.when',  body: ['faq.a.when'] },
  { q: 'faq.q.values', body: ['faq.a.values'], list: ['faq.a.kp02', 'faq.a.kp34', 'faq.a.kp5'] },
  { q: 'faq.q.clouds', body: ['faq.a.clouds'] },
  { q: 'faq.q.dark', body: ['faq.a.dark1', 'faq.a.dark2', 'faq.a.dark3'] },
  { q: 'faq.q.south', body: ['faq.a.south'] },
  { q: 'faq.q.know', body: ['faq.a.know'] },
  { q: 'faq.q.bz', body: ['faq.a.bz'] },
  { q: 'faq.q.gear', body: ['faq.a.gear1', 'faq.a.gear2', 'faq.a.gear3', 'faq.a.gear4', 'faq.a.gear5'] },
  { q: 'faq.q.tips', body: ['faq.a.tips1', 'faq.a.tips2'] },
];

export default function FaqPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('faq.pagetitle');
  }, [t]);

  return (
    <div className="faq-page">
      <Header />
    <main className="container" style={{ padding: '32px 16px', maxWidth: 860, margin: '0 auto' }}>
      <section className="hero" style={{ padding: '24px 0 16px' }}>
        <h1>{t('faq.title')}</h1>
        <p className="tagline">{t('faq.intro')}</p>
      </section>

      <section className="faq-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {QUESTIONS.map((item, idx) => (
          <details
            key={item.q}
            open={idx === 0}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '14px 18px',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '1.05rem' }}>
              {t(item.q)}
            </summary>
            <div className="faq-body" style={{ marginTop: 10, lineHeight: 1.6, opacity: 0.9 }}>
              {item.body.map((k) => (
                <p key={k} style={{ margin: '8px 0' }}>{t(k)}</p>
              ))}
              {item.list && (
                <ul style={{ paddingLeft: 22 }}>
                  {item.list.map((k) => <li key={k}>{t(k)}</li>)}
                </ul>
              )}
            </div>
          </details>
        ))}
      </section>
    </main>
    </div>
  );
}
