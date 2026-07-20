import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useTranslation from "./hooks/useTranslation";
import { activate, bySession, getAlerts, setAlerts, getTelegramLink } from "./lib/premium";

const SENSITIVITY_OPTIONS = [
  { value: "strong", fi: "Vain vahvat", en: "Only strong" },
  { value: "good", fi: "Hyvät mahdollisuudet", en: "Good chances" },
  { value: "all", fi: "Kaikki havainnot", en: "All sightings" },
];

/* ============================================================
 * Aurora Alerts -asetusosio
 * ============================================================
 * Näytetään heti onnistuneen premium-aktivoinnin jälkeen.
 * Kutsuu /api/alerts/settings (GET+POST) ja /api/alerts/telegram-link
 * lib/premium.js:n uusien helperien kautta. deviceKey haetaan
 * automaattisesti localStoragesta (ks. requireDeviceKey premium.js:ssä).
 * ============================================================ */
function AuroraAlertsSetup({ fi }) {
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

  // Lataa nykyiset asetukset (jos tilaus on jo olemassa tältä laitteelta)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAlerts();
if (cancelled) return;
setEmailSet(!!data.emailSet); // luetaan aina, myös kun active: false
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
      setSaveMsg({
        type: "error",
        text: fi ? "Selain ei tue sijainnin hakua." : "Your browser does not support geolocation.",
      });
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
        setSaveMsg({
          type: "error",
          text: fi
            ? "Sijainnin haku epäonnistui. Voit yhdistää Telegramin ja jakaa sijainnin sen kautta."
            : "Could not get your location. You can connect Telegram and share your location there instead.",
        });
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function handleSave() {
    if (lat == null || lon == null) {
      setSaveMsg({
        type: "error",
        text: fi
          ? "Aseta sijainti ensin (tai yhdistä Telegram ja jaa sijainti sen kautta)."
          : "Set a location first (or connect Telegram and share it from there).",
      });
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    try {
      const data = await setAlerts({ lat, lon, sensitivity, channel });
      setTelegramConnected(!!data.telegramConnected);
      setSaveMsg({ type: "success", text: fi ? "Asetukset tallennettu." : "Settings saved." });
    } catch (e) {
      setSaveMsg({
        type: "error",
        text: e?.message || (fi ? "Tallennus epäonnistui." : "Failed to save settings."),
      });
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
      setTgError(e?.message || (fi ? "Telegram-linkin haku epäonnistui." : "Failed to get Telegram link."));
    } finally {
      setTgLinking(false);
    }
  }

  const secondaryBtnStyle = {
    fontSize: 13,
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    cursor: "pointer",
  };

  if (!loaded) return null;

  return (
    <div
      style={{
        marginTop: 40,
        padding: 24,
        borderRadius: 12,
        border: "1px solid rgba(0,255,204,0.2)",
        background: "rgba(0,255,204,0.04)",
        textAlign: "left",
      }}
    >
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, marginBottom: 4 }}>
        🌌 RepoTracker Alerts
      </h2>
      <p style={{ color: "var(--fg-muted)", fontSize: 14, marginBottom: 20 }}>
        {fi
          ? "Saat ilmoituksen kun revontulien näkymismahdollisuudet paranevat sijainnissasi."
          : "Get notified when aurora conditions improve at your location."}
      </p>

      {/* Sijainti */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, color: "var(--fg-muted)", marginBottom: 6 }}>
          {fi ? "Sijainti" : "Location"}
        </label>
        {lat != null && lon != null ? (
          <p style={{ fontSize: 14, marginBottom: 8 }}>
            📍 {lat.toFixed(2)}, {lon.toFixed(2)}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 8 }}>
            {fi ? "Ei vielä asetettu." : "Not set yet."}
          </p>
        )}
        <button type="button" onClick={useMyLocation} disabled={locating} style={secondaryBtnStyle}>
          {locating
            ? fi
              ? "Haetaan…"
              : "Locating…"
            : fi
            ? "📍 Käytä nykyistä sijaintia"
            : "📍 Use current location"}
        </button>
      </div>

      {/* Herkkyys */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, color: "var(--fg-muted)", marginBottom: 6 }}>
          {fi ? "Herkkyys" : "Sensitivity"}
        </label>
        <select
          value={sensitivity}
          onChange={(e) => setSensitivity(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--bg-elevated, #12151c)",
            color: "var(--fg)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {SENSITIVITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {fi ? opt.fi : opt.en}
            </option>
          ))}
        </select>
      </div>

      {/* Kanava */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, color: "var(--fg-muted)", marginBottom: 6 }}>
          {fi ? "Kanava" : "Channel"}
        </label>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
            <input
              type="radio"
              name="alert-channel"
              value="telegram"
              checked={channel === "telegram"}
              onChange={() => setChannel("telegram")}
            />
            Telegram
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              opacity: emailSet ? 1 : 0.4,
            }}
          >
            <input
              type="radio"
              name="alert-channel"
              value="email"
              checked={channel === "email"}
              disabled={!emailSet}
              onChange={() => setChannel("email")}
            />
            {fi ? "Sähköposti" : "Email"}
            {!emailSet && (
              <span style={{ fontSize: 11 }}>
                {fi ? " (ei sähköpostia tiedossa)" : " (no email on file)"}
              </span>
            )}
          </label>
        </div>
      </div>

      {channel === "telegram" && (
        <div style={{ marginBottom: 20 }}>
          <button type="button" onClick={handleTelegramConnect} disabled={tgLinking} style={secondaryBtnStyle}>
            {tgLinking
              ? fi
                ? "Haetaan linkkiä…"
                : "Getting link…"
              : telegramConnected
              ? fi
                ? "✅ Telegram yhdistetty — yhdistä uudelleen"
                : "✅ Telegram connected — reconnect"
              : fi
              ? "Yhdistä Telegram →"
              : "Connect Telegram →"}
          </button>
          {tgError && <p style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{tgError}</p>}
          {!telegramConnected && (
            <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8 }}>
              {fi
                ? "Jos et ole vielä asettanut sijaintia yllä, botti pyytää sitä automaattisesti kytkennän jälkeen."
                : "If you haven't set a location above yet, the bot will ask for it automatically after connecting."}
            </p>
          )}
        </div>
      )}

      <button type="button" onClick={handleSave} disabled={saving} className="cta-btn" style={{ fontSize: 14 }}>
        {saving ? (fi ? "Tallennetaan…" : "Saving…") : fi ? "Tallenna asetukset" : "Save settings"}
      </button>

      {saveMsg && (
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: saveMsg.type === "error" ? "#ff6b6b" : "var(--accent)",
          }}
        >
          {saveMsg.text}
        </p>
      )}
    </div>
  );
}

export default function PremiumSuccessPage() {
  const { lang } = useTranslation();
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

          <AuroraAlertsSetup fi={fi} />

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