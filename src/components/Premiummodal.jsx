import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { startTrial } from "../lib/premium";

/* ========================================================================
   PremiumModal — rehellinen premium-myyntimodaali.
   - Oikeat kertahinnat (1/3/7 pv), ei tilausta, ei keksittyjä alennuksia
   - "Viime yönä" -osio näyttää VAIN toteutuneita lukuja workerin
     /api/aurora/highlights-endpointista (jos dataa ei ole, osio ei näy)
   - Osto ohjaa /premium-sivulle → suostumus + Stripe kuten aina
   - Ilmainen 6 h kokeilu erillisenä, hillittynä vaihtoehtona hintojen
     alla — ei kilpaile visuaalisesti maksuvaihtoehtojen kanssa
   Tyylit: PremiumModal.css (pm-*)

   Käyttö:
     const [showPm, setShowPm] = useState(false);
     <PremiumModal open={showPm} onClose={() => setShowPm(false)}
                   kp={kp} wind={wind} bz={bz} />
======================================================================= */

const BASE = process.env.REACT_APP_API_BASE || "";
const HL_CACHE_KEY = "aurora_session_cache:highlights:v1";
const HL_TTL_MS = 10 * 60 * 1000;

/* Oikeat hinnat — pidä synkassa workerin PREMIUM_TIERS-vakion kanssa */
const TIERS = [
  { key: "1d", days: 1, price: "2,99 €", perDay: null },
  { key: "3d", days: 3, price: "4,99 €", perDay: "≈ 1,66 €/pv", featured: true },
  { key: "7d", days: 7, price: "9,99 €", perDay: "≈ 1,43 €/pv" },
];

async function fetchHighlights() {
  try {
    const raw = sessionStorage.getItem(HL_CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && Date.now() - c.savedAt < HL_TTL_MS) return c.data;
    }
  } catch {}
  const res = await fetch(`${BASE}/api/aurora/highlights`);
  if (!res.ok) throw new Error(`highlights ${res.status}`);
  const data = await res.json();
  try {
    sessionStorage.setItem(HL_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {}
  return data;
}

export default function PremiumModal({ open, onClose, kp = null, wind = null, bz = null }) {
  const navigate = useNavigate();
  const { currentLanguage, t } = useTranslation();
  const [highlights, setHighlights] = useState(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const trh = (key, fi, en) => {
    const s = t(key);
    if (s != null && s !== key) return s;
    return currentLanguage === "en" ? en : fi;
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchHighlights()
      .then((d) => { if (!cancelled) setHighlights(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  // Nollataan trial-virhetila ja "älä näytä"-täppä aina kun modaali avataan uudelleen
  useEffect(() => {
    if (open) {
      setTrialError(null);
      setTrialLoading(false);
      setDontShowAgain(false);
    }
  }, [open]);

  // Lukitaan taustasivun scroll modaalin ollessa auki — ilman tätä
  // mobiilissa kosketusvieritys voi vierittää taustasivua modaalin alla,
  // jolloin syntyy vaikutelma että sisältö "jää modaalin alle".
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleClose = () => onClose?.(dontShowAgain);

  const locale = currentLanguage === "en" ? "en-GB" : "fi-FI";
  const fmtTime = (ms) =>
    new Date(ms).toLocaleString(locale, {
      weekday: "short", hour: "2-digit", minute: "2-digit",
    });

  const goBuy = (tierKey) => {
    onClose?.();
    navigate(`/premium${tierKey ? `?tier=${tierKey}` : ""}`);
  };

  async function handleTrial() {
    setTrialLoading(true);
    setTrialError(null);
    try {
      await startTrial();
      onClose?.();
      navigate("/map");
    } catch (e) {
      if (e?.status === 409) {
        setTrialError(trh(
          "pm.trialUsed",
          "Olet jo käyttänyt ilmaisen kokeilun tällä laitteella.",
          "You've already used the free trial on this device."
        ));
      } else if (e?.status === 429) {
        setTrialError(trh(
          "pm.trialLimit",
          "Kokeilurajoitus saavutettu. Osta Premium jatkaaksesi.",
          "Trial limit reached. Purchase Premium to continue."
        ));
      } else {
        setTrialError(trh("pm.trialError", "Kokeilun käynnistys epäonnistui.", "Could not start trial."));
      }
    } finally {
      setTrialLoading(false);
    }
  }

  /* "Viime yönä" -sisältö — näytetään vain jos oikeaa dataa on */
  const lastAlert = highlights?.lastAlert;
  const maxKp = highlights?.maxKp24h;
  const showAlertProof = lastAlert && lastAlert.count > 0;
  const showKpProof = !showAlertProof && maxKp != null && maxKp >= 4;

  return (
    <div className="pm-overlay" onClick={handleClose}>
      <div className="pm-box" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="pm-close" onClick={handleClose} aria-label={trh("pm.close", "Sulje", "Close")}>✕</button>

        <h2 className="pm-title">
          {trh("pm.title", "Näe koko kuva", "See the full picture")}{" "}
          <span className="pm-title-accent">
            {trh("pm.titleAccent", "— Premium", "— Premium")}
          </span>
        </h2>
        <p className="pm-sub">
          {trh("pm.sub",
            "Kertamaksu, ei tilausta. Aktivointi heti, toimii 3 laitteella.",
            "One-time payment, no subscription. Instant activation, works on 3 devices.")}
        </p>

        {/* Viime yön toteuma — vain oikeita lukuja hälytyshistoriasta */}
        {showAlertProof && (
          <div className="pm-proof">
            ⚡ {fmtTime(lastAlert.at)}
            {lastAlert.kp != null ? ` · Kp ${Number(lastAlert.kp).toFixed(1)}` : ""} —{" "}
            {trh("pm.proofAlert",
              `${lastAlert.count} premium-jäsentä sai hälytyksen puhelimeensa. Sinä?`,
              `${lastAlert.count} premium members got an alert on their phone. Did you?`)}
          </div>
        )}
        {showKpProof && (
          <div className="pm-proof">
            ⚡ {trh("pm.proofKp",
              `Viime yönä Kp nousi lukemaan ${maxKp.toFixed(1)} (klo ${fmtTime(highlights.maxAt)}) — premium-jäsenet näkivät sen ennusteesta etukäteen.`,
              `Last night Kp reached ${maxKp.toFixed(1)} (${fmtTime(highlights.maxAt)}) — premium members saw it coming in the forecast.`)}
          </div>
        )}

        {/* Vertailu — vain todellisia ominaisuuksia */}
        <div className="pm-compare">
          <div className="pm-col pm-col--free">
            <h4>{trh("pm.free", "Ilmainen", "Free")}</h4>
            <ul>
              <li>📊 {trh("pm.f1", "Kp-indeksi ja aktiivisuustaso", "Kp index & activity level")}</li>
              <li>⏱️ {trh("pm.f2", "Ennuste 24 h eteenpäin", "Forecast 24 h ahead")}</li>
              <li>🗺️ {trh("pm.f3", "3D-kartta (katselu)", "3D globe (view only)")}</li>
              <li>📍 {trh("pm.f4", "Havainnon raportointi + onnenpyörä", "Report sightings + prize wheel")}</li>
            </ul>
          </div>
          <div className="pm-vs"><span>VS</span></div>
          <div className="pm-col pm-col--premium">
            <h4>⭐ Premium</h4>
            <ul>
              <li>✅ <strong>{trh("pm.p1", "Koko 3 vrk ennuste", "Full 3-day forecast")}</strong></li>
              <li>✅ <strong>{trh("pm.p2", "Tarkka todennäköisyys-% joka paikalle", "Exact probability % for any location")}</strong></li>
              <li>✅ <strong>{trh("pm.p3", "Paras katseluikkuna kellonaikoineen", "Best viewing window with exact hours")}</strong></li>
              <li>✅ <strong>{trh("pm.p4", "Pyöritä & zoomaa 3D-karttaa + kerrokset", "Rotate & zoom the 3D globe + layers")}</strong></li>
              <li>✅ <strong>{trh("pm.p5", "Havainnot kartalla reaaliajassa", "Live sightings on the map")}</strong></li>
              <li>✅ <strong>{trh("pm.p6", "Telegram-/sähköpostihälytykset sijaintiisi", "Telegram/email alerts for your location")}</strong></li>
            </ul>
          </div>
        </div>

        {/* Miten todennäköisyys lasketaan — elävillä arvoilla jos saatavilla */}
        <div className="pm-formula">
          <div className="pm-formula-head">
            🧮 {trh("pm.how", "Miksi Kp yksin ei riitä?", "Why Kp alone isn't enough")}
          </div>
          <div className="pm-formula-row pm-formula-row--free">
            <span className="pm-formula-label">{trh("pm.free", "Ilmainen", "Free")}:</span>
            <span>Kp {kp != null ? kp.toFixed(1) : "2.0"} → “{trh("pm.level", "Kohtalainen aktiivisuus", "Moderate activity")}”</span>
          </div>
          <div className="pm-formula-arrow">⬇</div>
          <div className="pm-formula-row pm-formula-row--premium">
            <span className="pm-formula-label">⭐ Premium:</span>
            <span>
              Kp {kp != null ? kp.toFixed(1) : "2.0"}
              {" + "}{trh("pm.wind", "tuuli", "wind")} {wind != null ? Math.round(wind) : 450} km/s
              {" + "}Bz {bz != null ? bz.toFixed(1) : "-1.2"} nT
              {" + "}{trh("pm.clouds", "pilvisyys sijainnissasi", "clouds at your spot")}
              {" → "}<strong>{trh("pm.result", "tarkka % ja paras kellonaika", "exact % and the best hour")}</strong>
            </span>
          </div>
        </div>

        {/* Hinnat — oikeat kertahinnat */}
        <div className="pm-tiers">
          {TIERS.map((tier) => (
            <button
              key={tier.key}
              className={`pm-tier ${tier.featured ? "pm-tier--featured" : ""}`}
              onClick={() => goBuy(tier.key)}
            >
              {tier.featured && (
                <span className="pm-tier-badge">{trh("pm.popular", "SUOSITUIN", "MOST POPULAR")}</span>
              )}
              <span className="pm-tier-days">
                {tier.days} {trh("pm.days", tier.days === 1 ? "päivä" : "päivää", tier.days === 1 ? "day" : "days")}
              </span>
              <span className="pm-tier-price">{tier.price}</span>
              {tier.perDay && <span className="pm-tier-perday">{tier.perDay}</span>}
            </button>
          ))}
        </div>

        {/* Ilmainen kokeilu — hillitty, ei kilpaile maksuvaihtoehtojen kanssa */}
        <div className="pm-trial">
          {trialError ? (
            <p className="pm-trial-error">{trialError}</p>
          ) : (
            <button
              type="button"
              className="pm-trial-btn"
              onClick={handleTrial}
              disabled={trialLoading}
            >
              {trialLoading
                ? trh("pm.trialLoading", "Aktivoidaan…", "Activating…")
                : trh("pm.trialCta", "Tai kokeile ensin ilmaiseksi 6 h →", "Or try free for 6 hours first →")}
            </button>
          )}
        </div>

        <div className="pm-footer">
          <span>🔒 {trh("pm.stripe", "Turvallinen maksu (Stripe)", "Secure payment (Stripe)")}</span>
          <span>·</span>
          <span>{trh("pm.once", "Kertamaksu — ei tilausta", "One-time — no subscription")}</span>
          <span>·</span>
          <span>💳 {trh("pm.card", "Korttimaksu", "Card payment")}</span>
        </div>

        <label className="pm-dismiss">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          {trh("pm.dontShowAgain", "Älä näytä tätä uudelleen", "Don't show this again")}
        </label>

        <button className="pm-skip" onClick={handleClose}>
          {trh("pm.skip", "Jatkan ilmaisversiolla", "Continue with free version")}
        </button>
      </div>
    </div>
  );
}