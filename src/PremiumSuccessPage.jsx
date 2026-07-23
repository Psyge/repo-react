import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useTranslation from "./hooks/useTranslation";
import { activate, bySession, getAlerts, setAlerts, getTelegramLink } from "./lib/premium";

const SENSITIVITY_KEYS = [
  { value: "strong", key: "alerts.sensitivity.strong" },
  { value: "good", key: "alerts.sensitivity.good" },
  { value: "all", key: "alerts.sensitivity.all" },
];

/* ============================================================
 * Aurora Alerts -asetusosio
 * ============================================================
 * Näytetään heti onnistuneen premium-aktivoinnin jälkeen.
 * Kutsuu /api/alerts/settings (GET+POST) ja /api/alerts/telegram-link
 * lib/premium.js:n uusien helperien kautta. deviceKey haetaan
 * automaattisesti localStoragesta (ks. requireDeviceKey premium.js:ssä).
 * ============================================================ */
function AuroraAlertsSetup({ t }) {
  const [loaded, setLoaded] = useState(false);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [sensitivity, setSensitivity] = useState("good");
  const [channel, setChannel] = useState("telegram");
  const [emailSet, setEmailSet] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [tgLinking, setTgLinking] = useState(false);
  const [tgError, setTgError] = useState(null);
  const ranRef = useRef(false);

  // Lataa nykyiset asetukset (jos tilaus on jo olemassa tältä laitteelta)
  useEffect(() => {
    if (ranRef.current) return;
  ranRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const data = await getAlerts();
        if (cancelled) return;
        // emailSet luetaan aina — se koskee koko premium-tietuetta, ei
        // vielä-tallentamatonta alert-tilausta, joten se on saatavilla
        // vaikka active: false (ensimmäinen käynti sivulla).
        setEmailSet(!!data.emailSet);
        if (data.active) {
          setLat(data.lat ?? null);
          setLon(data.lon ?? null);
          setSensitivity(data.sensitivity || "good");
          setChannel(data.channel || "telegram");
          setTelegramConnected(!!data.telegramConnected);
        }
      } catch {
        // Ei vielä tilausta — jätetään oletusarvot, ei virheilmoitusta käyttäjälle.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setSaveMsg({ type: "error", text: t("alerts.location.unsupported") });
      return;
    }
    setLocating(true);
    setSaveMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 100) / 100);
        setLon(Math.round(pos.coords.longitude * 100) / 100);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setSaveMsg({ type: "error", text: t("alerts.location.error") });
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function handleSave() {
    if (lat == null || lon == null) {
      setSaveMsg({ type: "error", text: t("alerts.save.missingLocation") });
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    try {
      const data = await setAlerts({ lat, lon, sensitivity, channel });
      setTelegramConnected(!!data.telegramConnected);
      setSaveMsg({ type: "success", text: t("alerts.save.success") });
    } catch (e) {
      setSaveMsg({ type: "error", text: e?.message || t("alerts.save.error") });
    } finally {
      setSaving(false);
    }
  }

  async function handleTelegramConnect() {
    setTgLinking(true);
    setTgError(null);
    try {
      const data = await getTelegramLink();
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setTgError(e?.message || t("alerts.telegram.linkError"));
    } finally {
      setTgLinking(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="aurora-alerts-panel">
      <h2 className="aurora-alerts-panel__title">🌌 RepoTracker Alerts</h2>
      <p className="aurora-alerts-panel__subtitle">{t("alerts.subtitle")}</p>

      {/* Sijainti */}
      <div className="aurora-alerts-field">
        <label className="aurora-alerts-field__label">{t("alerts.location.label")}</label>
        {lat != null && lon != null ? (
          <p className="aurora-alerts-location__value">
            📍 {lat.toFixed(2)}, {lon.toFixed(2)}
          </p>
        ) : (
          <p className="aurora-alerts-location__empty">{t("alerts.location.notSet")}</p>
        )}
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="aurora-alerts-btn-secondary"
        >
          {locating ? t("alerts.location.locating") : t("alerts.location.useBtn")}
        </button>
      </div>

      {/* Herkkyys */}
      <div className="aurora-alerts-field">
        <label className="aurora-alerts-field__label">{t("alerts.sensitivity.label")}</label>
        <select
          value={sensitivity}
          onChange={(e) => setSensitivity(e.target.value)}
          className="aurora-alerts-select"
        >
          {SENSITIVITY_KEYS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.key)}
            </option>
          ))}
        </select>
      </div>

      {/* Kanava */}
      <div className="aurora-alerts-field aurora-alerts-field--channel">
        <label className="aurora-alerts-field__label">{t("alerts.channel.label")}</label>
        <div className="aurora-alerts-channel-options">
          <label className="aurora-alerts-channel-option">
            <input
              type="radio"
              name="alert-channel"
              value="telegram"
              checked={channel === "telegram"}
              onChange={() => setChannel("telegram")}
            />
            {t("alerts.channel.telegram")}
          </label>
          <label
            className={
              "aurora-alerts-channel-option" +
              (emailSet ? "" : " aurora-alerts-channel-option--disabled")
            }
          >
            <input
              type="radio"
              name="alert-channel"
              value="email"
              checked={channel === "email"}
              disabled={!emailSet}
              onChange={() => setChannel("email")}
            />
            {t("alerts.channel.email")}
            {!emailSet && (
              <span className="aurora-alerts-channel-option__note">
                {t("alerts.channel.noEmail")}
              </span>
            )}
          </label>
        </div>
      </div>

      {channel === "telegram" && (
        <div className="aurora-alerts-telegram-block">
          <button
            type="button"
            onClick={handleTelegramConnect}
            disabled={tgLinking}
            className="aurora-alerts-btn-secondary"
          >
            {tgLinking
              ? t("alerts.telegram.linking")
              : telegramConnected
              ? t("alerts.telegram.reconnect")
              : t("alerts.telegram.connect")}
          </button>
          {tgError && <p className="aurora-alerts-telegram-error">{tgError}</p>}
          {!telegramConnected && (
            <p className="aurora-alerts-telegram-hint">{t("alerts.telegram.hint")}</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="cta-btn aurora-alerts-save-btn"
      >
        {saving ? t("alerts.save.saving") : t("alerts.save.button")}
      </button>

      {saveMsg && (
        <p
          className={
            "aurora-alerts-save-msg " +
            (saveMsg.type === "error" ? "aurora-alerts-save-msg--error" : "aurora-alerts-save-msg--success")
          }
        >
          {saveMsg.text}
        </p>
      )}
    </div>
  );
}

export default function PremiumSuccessPage() {
  const { lang, t } = useTranslation();
  const fi = lang === "fi";

  const [state, setState] = useState({ kind: "loading" });

  useEffect(() => {
    document.title = fi ? "Aktivoidaan Premium…" : "Activating Premium…";
  }, [fi]);

  useEffect(() => {
    let cancelled = false;

    (async function run() {
      const params = new URLSearchParams(window.location.search);
      let token = params.get("token");
      const sessionId = params.get("session_id");

      try {
        // 1) Jos token puuttuu mutta session löytyy -> pollaa webhookin tulosta
        if (!token && sessionId) {
          try {
            token = await bySession(sessionId, {
              maxAttempts: 20,
              intervalMs: 1500,
              maxIntervalMs: 5000,
            });
          } catch {
            if (cancelled) return;
            return setState({
              kind: "error",
              title: fi ? "Maksua käsitellään…" : "Payment is processing…",
              hint: fi
                ? "Odota hetki ja päivitä sivu. Aktivointilinkki tulee myös sähköpostiisi."
                : "Please wait a moment and refresh this page. The activation link will also arrive in your email.",
            });
          }
        }

        // 2) Ei tokenia lainkaan
        if (!token) {
          if (cancelled) return;
          return setState({
            kind: "error",
            title: fi ? "Aktivointitunnus puuttuu" : "Missing activation token",
            hint: fi
              ? "Tarkista aktivointilinkki sähköpostistasi."
              : "Check your email for the activation link.",
          });
        }

        // 3) Aktivoi (installId menee mukana premium.js helperissa)
        const data = await activate(token);
        const days = Math.max(1, Math.ceil((data.expiresAt - Date.now()) / 86400000));

        if (cancelled) return;
        setState({ kind: "success", days });
      } catch (e) {
        if (cancelled) return;

        if (e?.status === 403) {
          setState({
            kind: "error",
            title: fi ? "Laiteraja saavutettu" : "Device limit reached",
            hint: fi
              ? "Tämä premium on jo aktivoitu 3 laitteella. Poista yksi vanhoista laitteista käytöstä jatkaaksesi."
              : "This premium pass has already been activated on 3 devices. Deactivate one of your other devices first.",
          });
        } else if (e?.status === 410) {
          setState({
            kind: "error",
            title: fi ? "Tämä pass on vanhentunut" : "This pass has expired",
            hint: fi ? "Osta uusi jatkaaksesi." : "Purchase a new one to continue.",
          });
        } else if (e?.status === 429) {
          setState({
            kind: "error",
            title: fi ? "Liikaa pyyntöjä" : "Too many requests",
            hint: fi
              ? "Yritä hetken kuluttua uudelleen."
              : "Please try again in a moment.",
          });
        } else {
          setState({
            kind: "error",
            title: fi ? "Aktivointi epäonnistui" : "Activation failed",
            hint:
              e?.message ||
              (fi
                ? "Yritä uudelleen tai ota yhteyttä tukeen."
                : "Try again or contact support."),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fi]);

  return (
    <main
      className="container"
      style={{ padding: "64px 16px", maxWidth: 560, textAlign: "center" }}
    >
      {state.kind === "loading" && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontFamily: "var(--font-display)" }}>
            {fi ? "Aktivoidaan Premiumiasi…" : "Activating your Premium…"}
          </h1>
          <p style={{ color: "var(--fg-muted)", marginTop: 12 }}>
            {fi
              ? "Tämä kestää yleensä muutaman sekunnin. Joskus maksun vahvistus voi kestää hieman pidempään."
              : "This usually takes a few seconds. In some cases, payment confirmation may take a little longer."}
          </p>
        </>
      )}

      {state.kind === "success" && (
        <>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✨</div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              background: "var(--gradient-aurora)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {fi ? "Premium aktivoitu!" : "Premium activated!"}
          </h1>
          <p style={{ color: "var(--fg-muted)", margin: "16px 0 32px" }}>
            {fi ? "Sinulla on " : "You have "}
            <strong style={{ color: "var(--accent)" }}>
              {state.days} {fi ? "päivää" : `day${state.days === 1 ? "" : "s"}`}
            </strong>
            {fi ? " täyttä pääsyä tällä laitteella." : " of full access on this device."}
          </p>
          <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>
            {fi
              ? "Aktivointilinkki on myös lähetetty sähköpostiisi — tallenna se, jotta voit käyttää ostoa enintään kahdella muulla laitteella."
              : "An activation link has also been sent to your email — bookmark it to use this purchase on up to 2 more devices."}
          </p>

          <AuroraAlertsSetup t={t} />

          <p style={{ marginTop: 32 }}>
            <Link to="/map" className="cta-btn">
              {fi ? "Avaa kartta →" : "Open the map →"}
            </Link>
          </p>
        </>
      )}

      {state.kind === "error" && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontFamily: "var(--font-display)" }}>{state.title}</h1>
          {state.hint && <p style={{ color: "var(--fg-muted)", marginTop: 12 }}>{state.hint}</p>}
          <p style={{ marginTop: 24 }}>
            <Link to="/premium" style={{ color: "var(--accent)" }}>
              {fi ? "Takaisin Premiumiin →" : "Back to Premium →"}
            </Link>
          </p>
        </>
      )}
    </main>
  );
}