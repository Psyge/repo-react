import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function Auroraassistant() {
  const { lang, currentLanguage } = useTranslation();
  const activeLang = lang || currentLanguage || "fi";
  const fi = activeLang === "fi";
  const navigate = useNavigate();

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
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
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
      <button
        type="button"
        className="aa-fab"
        onClick={toggleOpen}
        aria-label={fi ? (open ? "Sulje revontuliavustaja" : "Avaa revontuliavustaja") : (open ? "Close aurora assistant" : "Open aurora assistant")}
      >
        {open ? "✕" : "✨"}
      </button>

      {open && (
        <div className="aa-panel" role="dialog" aria-label={fi ? "Revontuliavustaja" : "Aurora assistant"}>
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
                    {m.content}
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