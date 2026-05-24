import useTranslation from "./hooks/useTranslation";
import { useEffect } from 'react';
import Header from "./components/Header";

const TERMS = [
  'privacy.a.terms1',
  'privacy.a.terms2',
  'privacy.a.terms3',
  'privacy.a.terms4',
  'privacy.a.terms5',
  'privacy.a.safety1',
  'privacy.a.safety2',
];

export default function TermsPage() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('privacy.q.terms')} — Aurora Tracker`;
  }, [t]);

  return (
    <div>

    <Header />
    <main className="container" style={{ padding: '32px 16px', maxWidth: 860, margin: '0 auto' }}>
      <section className="hero" style={{ padding: '24px 0 16px' }}>
        <h1>{t('privacy.q.terms')}</h1>
      </section>

      <section
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '20px 24px',
          lineHeight: 1.7,
        }}
      >
        {TERMS.map((k, i) => (
          <p key={k}>
            <strong>{i + 1}.</strong> {t(k)}
          </p>
        ))}
      </section>
    </main>
    </div>
  );
}
