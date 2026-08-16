import { useEffect, useRef, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { isKnownPath } from "../lib/routes";
import useTranslation from "../hooks/useTranslation";
import { isActive, read, startTrial } from "../lib/premium";

/* ========================================================================
   AuroraAssistant — kelluva AI-widget, kaikille näkyvä.
   - Sijoita kertaalleen App.jsx:ään Routerin sisälle: <AuroraAssistant />
   - PREMIUM (myös trial): oikea kysy-vastaa-chat, POST /api/assistant/ask
   - ILMAINEN: kiertävä AI-generoitu vihjelaatikko (GET /api/assistant/tips)
     + "Kokeile ilmaiseksi" / "Osta Premium" -kehotteet chatin sijaan
   - Sijainti kysytään vain premium-käyttäjältä, vasta paneelin avatessa
     (ei automaattista lupakyselyä), ja hiljaa jos evätty.
   - Kustannussuoja on kokonaan backendissä (per-IP + päiväkohtainen
     yläraja + trial-kohtainen viestiraja) — frontend näyttää palvelimen
     palauttamat virheviestit sellaisenaan.
======================================================================= */

const BASE = process.env.REACT_APP_API_BASE || "";
const TIP_ROTATE_MS = 8000;

/* Tervehdyskuplan kuittaus. localStorage eikä sessionStorage: kuittauksen
   pitää päteä myös seuraavalla käynnillä, ei vain tässä välilehdessä. */
const GREETING_KEY = "aurora_assistant_greeted";

/* Botin vastausten Markdown-linkit klikattaviksi.
 *
 * Dify-agentin ohje käskee sen kirjoittamaan viittaukset muodossa
 * [teksti](/polku). Aiemmin viesti renderöitiin sellaisenaan, joten
 * käyttäjä näki kirjaimellisesti "[Aseta hälytys](/alerts)" — linkki
 * oli olemassa mutta ei toiminut.
 *
 * Kolme tapausta:
 *   - tunnettu sisäinen polku → react-routerin Link (ei sivun uudelleen-
 *     latausta, widget pysyy auki)
 *   - ulkoinen https-osoite → tavallinen <a>, uuteen välilehteen
 *   - tuntematon polku → PELKKÄ TEKSTI. Agentti voi keksiä polun jota ei
 *     ole; sisäinen linkki sinne veisi tyhjälle sivulle ilman virhettä.
 *     Mieluummin turha sana kuin rikkinäinen linkki.
 */
const MD_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

export function renderMessageContent(text) {
  if (typeof text !== "string" || !text) return text;

  const parts = [];
  let lastIndex = 0;
  let key = 0;
  let match;

  MD_LINK.lastIndex = 0;   // regex on moduulitasolla → nollaa tila

  while ((match = MD_LINK.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    const [full, label, url] = match;

    if (isKnownPath(url)) {
      parts.push(
        <Link key={`k${key++}`} to={url} className="aa-link">
          {label}
        </Link>
      );
    } else if (/^https?:\/\//i.test(url)) {
      parts.push(
        <a
          key={`k${key++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="aa-link"
        >
          {label}
        </a>
      );
    } else {
      parts.push(label);   // tuntematon polku → pelkkä teksti
    }

    lastIndex = match.index + full.length;
  }

  if (!parts.length) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function Auroraassistant() {
  const { lang, currentLanguage } = useTranslation();
  const activeLang = lang || currentLanguage || "fi";
  const fi = activeLang === "fi";
  const navigate = useNavigate();

  /* Karttasivulla on alareunassa kiinteä näkymänvalitsin (.map-view-toggle,
     keskitetty, kolme nappia). Kapealla näytöllä se ulottuu nurkkaan asti
     ja jäi kelluvan napin alle — molemmat ovat position: fixed. Nostetaan
     nappi ja paneeli palkin yläpuolelle vain tällä sivulla. */
  const onMapPage = useLocation().pathname === "/map";

  const [open, setOpen] = useState(false);
  const [premium, setPremium] = useState(null); // { deviceKey, expiresAt, tier } | null

  // --- Premium: chat-tila ---
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);
  const askedLocationRef = useRef(false);
  const scrollRef = useRef(null);

  /* Mihin vastauksiin on jo annettu peukku. Indeksi kelpaa avaimeksi,
     koska messages on append-only — vanhoja viestejä ei koskaan poisteta
     eikä järjestetä uudelleen. */
  const [rated, setRated] = useState(() => new Set());

  /* Tervehdyskupla. Näytetään vain premium-käyttäjälle, jolle avustaja on
     ostettu ominaisuus — ilmaiskäyttäjälle sama kupla olisi mainos.
     Hylkäys tallennetaan localStorageen PYSYVÄSTI: joka sivulatauksella
     ponnahtava tervehdys muuttuu ärsyttäväksi noin kolmannella kerralla,
     ja juuri maksanut asiakas on huonoin mahdollinen kohde ärsyttää. */
  const [greeting, setGreeting] = useState(false);
  const greetingTimerRef = useRef(null);

  function dismissGreeting() {
    setGreeting(false);
    try { localStorage.setItem(GREETING_KEY, "1"); } catch {}
  }

  useEffect(() => {
    let cancelled = false;
    try {
      if (localStorage.getItem(GREETING_KEY)) return;
    } catch {
      return;   // yksityinen selaustila tms. — ei näytetä, jottei toistu
    }
    if (!isActive()) return;

    /* Pieni viive: heti latauksen päälle ilmestyvä kupla jää huomaamatta
       kun sivu vielä asettuu paikoilleen. */
    greetingTimerRef.current = setTimeout(() => {
      if (!cancelled) setGreeting(true);
    }, 2500);

    return () => {
      cancelled = true;
      clearTimeout(greetingTimerRef.current);
    };
  }, []);

  // --- Ilmainen: vihjelaatikon tila ---
  const [tips, setTips] = useState([]);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState(null);
  const tipsTimerRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Vihjeiden kierrätys — vain kun paneeli auki ja käyttäjä ei ole premium
  useEffect(() => {
    if (!open || premium || tips.length <= 1) return;
    tipsTimerRef.current = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, TIP_ROTATE_MS);
    return () => clearInterval(tipsTimerRef.current);
  }, [open, premium, tips.length]);

  function requestLocationOnce() {
    if (askedLocationRef.current) return;
    askedLocationRef.current = true;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}, // hiljainen epäonnistuminen — avustaja toimii silti
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  async function loadTips() {
    setTipsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/assistant/tips`);
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.tips) && data.tips.length) {
        setTips(data.tips);
        setTipIndex(0);
      }
    } catch {
      // hiljainen epäonnistuminen — laatikko näyttää vain tyhjän tilan
    } finally {
      setTipsLoading(false);
    }
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        dismissGreeting();       // avaaminen on itsessään kuittaus
        const p = isActive() ? read() : null;
        setPremium(p);
        if (p) {
          requestLocationOnce();
        } else if (tips.length === 0) {
          loadTips();
        }
      }
      return next;
    });
  }

  /* Peukku vastaukselle. Merkitään heti annetuksi eikä odoteta palvelimen
     vastausta: palaute on mukavuusominaisuus, eikä sen epäonnistuminen saa
     näkyä käyttäjälle virheenä keskellä keskustelua. */
  async function handleFeedback(index, rating) {
    if (rated.has(index) || !premium) return;
    setRated((prev) => new Set(prev).add(index));

    const msg = messages[index];
    try {
      await fetch(`${BASE}/api/assistant/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceKey: premium.deviceKey,
          rating,
          question: msg?.question || "",
          answer: msg?.content || "",
          conversationId,
        }),
      });
    } catch {
      // hiljainen epäonnistuminen — tarkoituksella
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || !premium) return;

    setError(null);
    // Paikallinen näyttöhistoria säilyy UI:ta varten, mutta palvelimelle
    // lähetetään VAIN uusin kysymys + conversationId — Dify muistaa
    // aiemman keskustelun omalla puolellaan conversation_id:n avulla.
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE}/api/assistant/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          conversationId,
          deviceKey: premium.deviceKey,
          lat: coords?.lat,
          lon: coords?.lon,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || (fi ? "Jokin meni pieleen. Yritä uudelleen." : "Something went wrong. Try again."));
        return;
      }

      if (data.conversationId) setConversationId(data.conversationId);
      // question talteen, jotta palaute kertoo MIHIN kysymykseen vastaus
      // liittyi — pelkkä vastaus ilman kysymystä on lokissa arvoton
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, question: text },
      ]);
    } catch {
      setError(fi ? "Yhteysvirhe. Yritä hetken kuluttua uudelleen." : "Connection error. Try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleTryTrial() {
    setTrialLoading(true);
    setTrialError(null);
    try {
      await startTrial();
      // Vaihdetaan heti chat-tilaan onnistuneen aktivoinnin jälkeen
      setPremium(isActive() ? read() : null);
      requestLocationOnce();
    } catch (e) {
      if (e?.status === 409) {
        setTrialError(fi ? "Olet jo käyttänyt ilmaisen kokeilun tällä laitteella." : "You've already used the free trial on this device.");
      } else if (e?.status === 429) {
        setTrialError(fi ? "Kokeilurajoitus saavutettu." : "Trial limit reached.");
      } else {
        setTrialError(fi ? "Kokeilun käynnistys epäonnistui." : "Could not start trial.");
      }
    } finally {
      setTrialLoading(false);
    }
  }

  function goPremium() {
    setOpen(false);
    navigate("/premium");
  }

  return (
    <>
      {greeting && !open && (
        <div className={`aa-greeting${onMapPage ? " aa-greeting--raised" : ""}`}>
          <span className="aa-greeting-text">
            {fi
              ? "Hei! Kysy minulta revontulista — kerron mitä taivaalla juuri nyt tapahtuu."
              : "Hi! Ask me about the northern lights — I'll tell you what's happening right now."}
          </span>
          <button
            type="button"
            className="aa-greeting-close"
            onClick={dismissGreeting}
            aria-label={fi ? "Sulje tervehdys" : "Dismiss"}
          >
            ✕
          </button>
        </div>
      )}

      <button
        type="button"
        className={`aa-fab${onMapPage ? " aa-fab--raised" : ""}`}
        onClick={toggleOpen}
        aria-label={fi ? (open ? "Sulje revontuliavustaja" : "Avaa revontuliavustaja") : (open ? "Close aurora assistant" : "Open aurora assistant")}
      >
        {open ? "✕" : "✨"}
      </button>

      {open && (
        <div
          className={`aa-panel${onMapPage ? " aa-panel--raised" : ""}`}
          role="dialog"
          aria-label={fi ? "Revontuliavustaja" : "Aurora assistant"}
        >
          <div className="aa-panel-head">
            <span className="aa-panel-title">
              🌌 {fi ? "Revontuliavustaja" : "Aurora Assistant"}
            </span>
          </div>

          {premium ? (
            <>
              <div className="aa-messages" ref={scrollRef}>
                {messages.length === 0 && (
                  <div className="aa-empty">
                    {fi
                      ? 'Kysy vaikka: "Kannattaako tänä iltana lähteä katsomaan?"'
                      : 'Try asking: "Is tonight worth going out for?"'}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`aa-msg aa-msg--${m.role}`}>
                    {m.role === "assistant"
                      ? renderMessageContent(m.content)
                      : m.content}

                    {m.role === "assistant" && (
                      <div className="aa-feedback">
                        {rated.has(i) ? (
                          <span className="aa-feedback-thanks">
                            {fi ? "Kiitos palautteesta" : "Thanks for the feedback"}
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="aa-feedback-btn"
                              onClick={() => handleFeedback(i, "up")}
                              aria-label={fi ? "Hyödyllinen vastaus" : "Helpful answer"}
                              title={fi ? "Hyödyllinen" : "Helpful"}
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              className="aa-feedback-btn"
                              onClick={() => handleFeedback(i, "down")}
                              aria-label={fi ? "Ei hyödyllinen vastaus" : "Not helpful"}
                              title={fi ? "Ei hyödyllinen" : "Not helpful"}
                            >
                              👎
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="aa-msg aa-msg--assistant aa-msg--loading">
                    {fi ? "Mietitään…" : "Thinking…"}
                  </div>
                )}
              </div>

              {error && <div className="aa-error">{error}</div>}

              <div className="aa-input-row">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={fi ? "Kirjoita kysymys…" : "Type a question…"}
                  maxLength={500}
                  disabled={loading}
                />
                <button type="button" onClick={handleSend} disabled={loading || !input.trim()}>
                  {fi ? "Lähetä" : "Send"}
                </button>
              </div>
            </>
          ) : (
            <div className="aa-free">
              <div className="aa-tip-box">
                {tipsLoading && tips.length === 0 ? (
                  <span className="aa-tip-loading">{fi ? "Ladataan vihjettä…" : "Loading tip…"}</span>
                ) : tips.length > 0 ? (
                  <span className="aa-tip-text">💡 {tips[tipIndex]}</span>
                ) : (
                  <span className="aa-tip-loading">
                    {fi ? "Vihjeitä ei juuri nyt saatavilla." : "No tips available right now."}
                  </span>
                )}
              </div>

              <p className="aa-free-note">
                {fi
                  ? "Kysy-vastaa-avustaja on Premium-ominaisuus."
                  : "The Q&A assistant is a Premium feature."}
              </p>

              {trialError && <div className="aa-error">{trialError}</div>}

              <div className="aa-free-actions">
                <button type="button" className="aa-btn-secondary" onClick={handleTryTrial} disabled={trialLoading}>
                  {trialLoading
                    ? (fi ? "Aktivoidaan…" : "Activating…")
                    : (fi ? "Kokeile ilmaiseksi 6 h" : "Try free for 6 hours")}
                </button>
                <button type="button" className="aa-btn-primary" onClick={goPremium}>
                  {fi ? "Osta Premium →" : "Get Premium →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}