import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useTranslation from "./hooks/useTranslation";

import {
  activate,
  bySession,
} from "./lib/premium";

export default function PremiumSuccessPage() {
  const { lang } = useTranslation();
const fi = lang === 'fi';
  const [state, setState] = useState({ kind: 'loading' });

  useEffect(() => {
    document.title = fi ? 'Aktivoidaan Premium…' : 'Activating Premium…';
  }, [fi]);

  useEffect(() => {
    (async function run() {
      const params = new URLSearchParams(window.location.search);
      let token = params.get('token');
      const sessionId = params.get('session_id');

      try {
        if (!token && sessionId) {
          try {
            token = await bySession(sessionId);
          } catch {
            return setState({
              kind: 'error',
              title: fi ? 'Maksua käsitellään…' : 'Payment is processing…',
              hint: fi
                ? 'Odota hetki ja päivitä sivu. Aktivointilinkki tulee myös sähköpostiisi.'
                : 'Please wait a moment and refresh this page. The activation link will also arrive in your email.',
            });
          }
        }
        if (!token) {
          return setState({
            kind: 'error',
            title: fi ? 'Aktivointitunnus puuttuu' : 'Missing activation token',
            hint: fi ? 'Tarkista aktivointilinkki sähköpostistasi.' : 'Check your email for the activation link.',
          });
        }

        const data = await activate(token);
        const days = Math.max(
  1,
  Math.ceil((data.expiresAt - Date.now()) / 86400000)
);
        setState({ kind: 'success', days });
      } catch (e) {
        if (e.status === 403) {
          setState({
            kind: 'error',
            title: fi ? 'Laiteraja saavutettu' : 'Device limit reached',
            hint: fi
              ? 'Tämä premium on jo aktivoitu 3 laitteella. Poista yksi vanhoista laitteista käytöstä jatkaaksesi.'
              : 'This premium pass has already been activated on 3 devices. Deactivate one of your other devices first.',
          });
        } else if (e.status === 410) {
          setState({
            kind: 'error',
            title: fi ? 'Tämä pass on vanhentunut' : 'This pass has expired',
            hint: fi ? 'Osta uusi jatkaaksesi.' : 'Purchase a new one to continue.',
          });
        } else {
          setState({
            kind: 'error',
            title: fi ? 'Aktivointi epäonnistui' : 'Activation failed',
            hint: e.message || (fi ? 'Yritä uudelleen tai ota yhteyttä tukeen.' : 'Try again or contact support.'),
          });
        }
      }
    })();
  }, [fi]);

  return (
    <main className="container" style={{ padding: '64px 16px', maxWidth: 560, textAlign: 'center' }}>
      {state.kind === 'loading' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontFamily: 'var(--font-display)' }}>
            {fi ? 'Aktivoidaan Premiumiasi…' : 'Activating your Premium…'}
          </h1>
          <p style={{ color: 'var(--fg-muted)', marginTop: 12 }}>
            {fi ? 'Tämä kestää yleensä muutaman sekunnin.' : 'This usually takes a few seconds.'}
          </p>
        </>
      )}

      {state.kind === 'success' && (
        <>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✨</div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              background: 'var(--gradient-aurora)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {fi ? 'Premium aktivoitu!' : 'Premium activated!'}
          </h1>
          <p style={{ color: 'var(--fg-muted)', margin: '16px 0 32px' }}>
            {fi ? 'Sinulla on ' : 'You have '}
            <strong style={{ color: 'var(--accent)' }}>
              {state.days} {fi ? 'päivää' : `day${state.days === 1 ? '' : 's'}`}
            </strong>
            {fi ? ' täyttä pääsyä tällä laitteella.' : ' of full access on this device.'}
          </p>
          <p style={{ color: 'var(--fg-muted)', fontSize: 14 }}>
            {fi
              ? 'Aktivointilinkki on myös lähetetty sähköpostiisi — tallenna se, jotta voit käyttää ostoa enintään kahdella muulla laitteella.'
              : 'An activation link has also been sent to your email — bookmark it to use this purchase on up to 2 more devices.'}
          </p>
          <p style={{ marginTop: 32 }}>
            <Link to="/map" className="cta-btn">
              {fi ? 'Avaa kartta →' : 'Open the map →'}
            </Link>
          </p>
        </>
      )}

      {state.kind === 'error' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontFamily: 'var(--font-display)' }}>{state.title}</h1>
          {state.hint && <p style={{ color: 'var(--fg-muted)', marginTop: 12 }}>{state.hint}</p>}
          <p style={{ marginTop: 24 }}>
            <Link to="/premium" style={{ color: 'var(--accent)' }}>
              {fi ? 'Takaisin Premiumiin →' : 'Back to Premium →'}
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
