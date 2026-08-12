import { useEffect, useRef, useState } from "react";
import { getAlerts, setAlerts, getTelegramLink } from "../lib/premium";

const SENSITIVITY_KEYS = [
  { value: "strong", key: "alerts.sensitivity.strong" },
  { value: "good", key: "alerts.sensitivity.good" },
  { value: "all", key: "alerts.sensitivity.all" },
];

/* ============================================================
 * Aurora Alerts -asetusosio
 * ============================================================
 * Omana komponenttinaan, jotta samaa toteutusta voi käyttää sekä
 * PremiumSuccessPagessa (oston jälkeen) että /alerts-sivulla.
 *
 * /alerts on olemassa erityisesti AI-avustajaa varten: Dify-agentin ohje
 * käskee sen ehdottamaan hälytystä muodossa [Aseta hälytys](/alerts) kun
 * olosuhteet ovat huonot juuri nyt. Ilman vakaata osoitetta asetukset
 * olisivat vain ostoputken takana.
 *
 * Kutsuu /api/alerts/settings (GET+POST) ja /api/alerts/telegram-link
 * lib/premium.js:n helperien kautta. deviceKey haetaan automaattisesti
 * localStoragesta.
 * ============================================================ */
export default function AuroraAlertsSetup({ t }) {
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

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const data = await getAlerts();
        if (cancelled) return;
        setEmailSet(!!data.emailSet);
        if (data.active) {
          setLat(data.lat ?? null);
          setLon(data.lon ?? null);
          setSensitivity(data.sensitivity || "good");
          setChannel(data.channel || "telegram");
          setTelegramConnected(!!data.telegramConnected);
        }
      } catch {
        // Ei vielä tilausta — oletusarvot kelpaavat, ei virhettä käyttäjälle.
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
            (saveMsg.type === "error"
              ? "aurora-alerts-save-msg--error"
              : "aurora-alerts-save-msg--success")
          }
        >
          {saveMsg.text}
        </p>
      )}
    </div>
  );
}
