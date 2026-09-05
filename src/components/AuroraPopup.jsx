import { useState } from "react";
import useTranslation from "../hooks/useTranslation";

/* Yhteinen sulkunappi — sama rasti samassa paikassa sekä 2D- että
 * 3D-kartalla. Näkyy vain jos onClose-callback on annettu. */
function CloseBtn({ onClose }) {
  if (!onClose) return null;
  return (
    <button className="ap-close" onClick={onClose} aria-label="Close">
      ✕
    </button>
  );
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/* "12 min" / "3 h" — pelkkä kesto ilman sanamuotoa, jotta sama apuri
   kelpaa sekä "mitattu X sitten" että "aurinkotuuli X vanha" -riveille. */
function ageSpan(ms) {
  if (ms == null || !isFinite(ms) || ms < 0) return null;
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))} min`;
  return `${Math.floor(ms / HOUR)} h`;
}

/* Ikämerkintä.
 *
 * Worker palauttaa current.kpTs:n ja current.stale-lohkon nimenomaan tätä
 * varten. Sen oma kommentti kertoo miksi: Kp on kolmen tunnin indeksi, joten
 * tuorekin arvo on aina hieman vanha, eikä jäätynyttä arvoa erota tuoreesta
 * ilman merkintää. Sivusto näytti kerran yli vuorokauden vanhaa Kp:tä eikä
 * mikään kertonut siitä — worker korjattiin silloin, käyttöliittymä ei.
 *
 * stale tarkoittaa että aurinkotuulen arvot (nopeus, tiheys, Bz) ovat vanhoja.
 * Worker EI syötä niitä laskentaan, mutta näyttää ne ikämerkinnän kanssa —
 * sama sääntö pätee täällä: arvo saa näkyä, kunhan sen ikä näkyy myös.
 *
 * Kentät tulevat vain /api/aurora/forecast -vastauksesta. Litteä
 * /api/aurora/calc ei sisällä aikaleimoja, jolloin merkintä jää pois.
 * Ikää ei arvata. */
function DataAge({ ts, stale, t }) {
  let measured = null;
  if (ts != null) {
    const ms = Date.now() - new Date(ts).getTime();
    if (isFinite(ms) && ms >= 0) {
      measured = ms < 2 * MINUTE
        ? t("age.justnow", "just now")
        : `${ageSpan(ms)} ${t("age.ago", "ago")}`;
    }
  }

  const windAge = stale ? ageSpan(stale.ageMs) : null;
  if (!measured && !windAge) return null;

  return (
    <div className={"ap-age" + (windAge ? " ap-age--stale" : "")}>
      {measured && <span>{t("age.measured", "Measured")} {measured}</span>}
      {windAge && (
        <span>
          ⚠ {t("age.wind", "solar wind")} {windAge} {t("age.old", "old")}
        </span>
      )}
    </div>
  );
}

const DIR_KEYS = ["dir.n", "dir.ne", "dir.e", "dir.se", "dir.s", "dir.sw", "dir.w", "dir.nw"];

/* Suunta lasketaan täällä eikä lueta workerin chase.dir-kentästä.
   Worker muodostaa sen bearingLabelilla, jonka oletuskieli on suomi, joten
   englanninkielinen käyttöliittymä näyttäisi suomenkielisen sanan. Samasta
   syystä chaseSummary ja safetyNote jätetään käyttämättä — ne ovat valmiiksi
   muotoiltuja suomenkielisiä lauseita Dify-agenttia varten. */
function bearingKey(fromLat, fromLon, toLat, toLon) {
  const rad = Math.PI / 180;
  const dLon = (toLon - fromLon) * rad;
  const y = Math.sin(dLon) * Math.cos(toLat * rad);
  const x = Math.cos(fromLat * rad) * Math.sin(toLat * rad) -
            Math.sin(fromLat * rad) * Math.cos(toLat * rad) * Math.cos(dLon);
  const deg = (Math.atan2(y, x) / rad + 360) % 360;
  return DIR_KEYS[Math.round(deg / 45) % 8];
}

/* Ajosuositus.
 *
 * Worker laskee tämän vain kun se on oikeasti toiminnallinen: sijainnissa on
 * pilvistä, aktiivisuus riittäisi näkymiseen ja on pimeää. Muulloin chase on
 * null eikä ajamista ehdoteta. Kenttä on ollut vastauksessa alusta asti mutta
 * jäänyt näyttämättä.
 *
 * Tulee kahdessa paikassa vastausmuodosta riippuen: /api/aurora/forecast
 * liittää sen current-lohkoon, /api/aurora/calc ylimmälle tasolle. */
function ChaseTip({ fromLat, fromLng, chase, t }) {
  if (!chase || chase.lat == null || chase.lon == null) return null;

  const dir = t(bearingKey(fromLat, fromLng, chase.lat, chase.lon));

  return (
    <div className="ap-chase">
      <div className="ap-chase-head">
        🚗 {t("chase.title", "Clearer skies nearby")}
      </div>

      <div className="ap-chase-place">
        <strong>{chase.name}</strong>
        <span>
          {chase.roadKm} km {dir} · ~{chase.driveMin} min
        </span>
      </div>

      <div className="ap-chase-stats">
        {t("chase.there", "There")} <strong>{chase.probability}%</strong>
        {chase.clouds != null && <> · {t("row.clouds", "Clouds")} {chase.clouds}%</>}
      </div>

      {chase.mapsUrl && (
        <a
          className="ap-chase-link"
          href={chase.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("chase.route", "Directions")} →
        </a>
      )}

      <div className="ap-chase-note">{t("chase.safety", "An estimate, not a certainty.")}</div>
    </div>
  );
}

export default function AuroraPopup({
  lat,
  lng,
  data,
  error,
  premium = false,
  loading = false,
  onClose = null,
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("now");

  if (!data && !error) {
    return (
      <div className="aurora-popup aurora-popup--compact">
        <CloseBtn onClose={onClose} />
        <Loc lat={lat} lng={lng} />
        <div className="ap-desc">{t("loading", "Loading…")}</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="aurora-popup aurora-popup--compact">
        <CloseBtn onClose={onClose} />
        <Loc lat={lat} lng={lng} />
        <div className="ap-desc ap-desc--error">{t("error.fetch", "Failed to load data")}</div>
      </div>
    );
  }

  const isPremium = data?.tier === "premium";
  const currentSlot = isPremium ? (data?.slots?.[0] ?? null) : null;

  /* Worker palauttaa KAKSI eri muotoa, ja popup saa molempia:
   *
   *   /api/aurora/forecast → { tier, slots, bestWindow, current: { kp, bz, … } }
   *   /api/aurora/calc     → litteä { tier, kp, level, clouds, … }
   *
   * Globeview valitsee näiden väliltä deviceKeyn perusteella, eli
   * ilmaiskäyttäjä saa aina litteän vastauksen. Pelkkä data.current.kp
   * jäi siksi nulliksi ja popup näytti "Kp –" ja aina "Low" — täsmälleen
   * sen oireen, joka tämän oli määrä korjata. Luetaan molemmat muodot. */
  const currentKp = data?.current?.kp ?? data?.kp ?? null;
  const kp = isPremium ? (currentSlot?.kp ?? null) : currentKp;
  const probability = isPremium ? (currentSlot?.probability ?? null) : null;
  const clouds = isPremium ? (currentSlot?.clouds ?? null) : (data?.clouds ?? null);
  const chase = data?.current?.chase ?? data?.chase ?? null;
  const bz = data?.current?.bz ?? data?.bz ?? null;
  const speed = data?.current?.speed ?? data?.speed ?? null;
  const density = data?.current?.density ?? data?.density ?? null;
  const level = isPremium
    ? (currentSlot?.level ?? probabilityToLevel(probability))
    /* Workerin oma level huomioi pilvisyyden ja mitatun magnetometridatan,
       kpLevel pelkän Kp:n. Käytetään workerin arviota kun se on mukana. */
    : (data?.level ?? kpLevel(currentKp));
  const color = levelColor(level);
  const levelLabel = t(`probability.${level}`, level);

  // --- FREE ---
  /* Käyttää samoja popup.css-luokkia kuin premium-haara. Aiemmin tämä oli
     kokonaan inline-tyyleillä — mukaan lukien upsell-nappi kymmenellä
     tyyliattribuutilla — ja näytti vierekkäin premiumin kanssa eri tuotteelta.
     Se on huono paikka näyttää keskeneräiseltä, koska juuri tässä myydään. */
  if (!isPremium) {
    return (
      <div className="aurora-popup aurora-popup--free">
        <CloseBtn onClose={onClose} />
        <Loc lat={lat} lng={lng} />

        <div className="ap-status">
          <div className="ap-status-level" style={{ color }}>{levelLabel}</div>
        </div>

        <div className="ap-quick ap-quick--two">
          <div>
            <span>{t("kp.label", "Kp")}</span>
            <strong>{kp != null ? fmt(kp) : "–"}</strong>
          </div>
          <div>
            <span>{t("row.clouds", "Clouds")}</span>
            <strong>{clouds != null ? `${clouds}%` : "–"}</strong>
          </div>
        </div>

        <DataAge ts={data?.current?.kpTs} stale={data?.current?.stale} t={t} />

        {loading && <div className="ap-desc">{t("loading", "Loading…")}</div>}

        <a className="ap-toggle" href="/premium">
          {t("forecast.popup_full", "Unlock full forecast — from 2,99 €")}
        </a>
      </div>
    );
  }

  // --- PREMIUM ---
  const bestWindow = data?.bestWindow ?? null;
  const slots = (data?.slots ?? []).slice(0, 8);

  return (
    <div className="aurora-popup aurora-popup--premium">
      <CloseBtn onClose={onClose} />
      <Loc lat={lat} lng={lng} />

      {/* Välilehdet */}
      <div className="ap-tabs">
        <button
          className={`ap-tab ${tab === "now" ? "ap-tab--active" : ""}`}
          onClick={() => setTab("now")}
        >
          {t("tab.now", "Now")}
        </button>
        <button
          className={`ap-tab ${tab === "forecast" ? "ap-tab--active" : ""}`}
          onClick={() => setTab("forecast")}
        >
          {t("tab.forecast", "Forecast")}
        </button>
      </div>

      {/* Päivityksen merkki myös premium-näkymässä */}
      {loading && (
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
          {t("loading", "Loading…")}
        </div>
      )}

      {tab === "now" && (
        <>
          {/* Iso tila-teksti, dynaaminen prosentti */}
          <div className="ap-status">
            <div className="ap-status-level" style={{ color }}>
              {levelLabel}
            </div>
            <div className="ap-status-prob" style={{ color }}>
              {probability != null ? `${probability}%` : "–"}
            </div>
          </div>

          <DataAge ts={data?.current?.kpTs} stale={data?.current?.stale} t={t} />

          {/* Paras ikkuna */}
          {bestWindow && (
            <div className="ap-window">
              ⏰ {t("window.best", "Best window")}{" "}
              {formatWindowRange(bestWindow.start, bestWindow.end)}
              {bestWindow.peakKp != null && (
                <span style={{ opacity: 0.7 }}> · Kp {bestWindow.peakKp}</span>
              )}
            </div>
          )}

          <ChaseTip fromLat={lat} fromLng={lng} chase={chase} t={t} />

          {/* Quick stats */}
          <div className="ap-quick">
            <div>
              <span>{t("kp.label", "Kp")}</span>
              <strong>{fmt(kp)}</strong>
            </div>
            <div>
              <span>{t("row.clouds", "Clouds")}</span>
              <strong>{clouds != null ? `${clouds}%` : "–"}</strong>
            </div>
            <div>
              <span>{t("bz.label", "Bz")}</span>
              <strong>{fmt(bz)}</strong>
            </div>
          </div>

          {/* Solar wind */}
          <div className="ap-details">
            <div>
              <span>{t("wind.speed", "Solar wind")}</span>
              <strong>{fmt(speed, " km/s", 0)}</strong>
            </div>
            <div>
              <span>{t("wind.density", "Density")}</span>
              <strong>{fmt(density, " p/cm³")}</strong>
            </div>
          </div>
        </>
      )}

      {tab === "forecast" && (
        <div className="ap-forecast">
          {slots.length > 0 ? slots.map((s, i) => (
            <ForecastRow
              key={s.tsUtc}
              slot={s}
              showDay={dayChanged(slots[i - 1]?.tsUtc, s.tsUtc)}
            />
          )) : (
            <div style={{ opacity: 0.5, fontSize: 12, marginTop: 8 }}>
              {t("forecast.nodata", "No forecast data")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ForecastRow({ slot, showDay = false }) {
  const prob = slot.probability ?? 0;
  const color = levelColor(slot.level ?? "low");
  const hour = formatLocalHour(slot.tsUtc);

  return (
    <div className="ap-frow">
      <div className="ap-frow-time">
        {showDay && (
          <span style={{ display: "block", fontSize: 9, opacity: 0.55, textTransform: "capitalize" }}>
            {formatWeekday(slot.tsUtc)}
          </span>
        )}
        {hour}
      </div>
      <div className="ap-frow-bar-bg">
        <div className="ap-frow-bar" style={{ width: `${prob}%`, background: color + "66" }} />
      </div>
      <div className="ap-frow-pct" style={{ color }}>{prob}%</div>
    </div>
  );
}

function Loc({ lat, lng }) {
  return (
    <div className="ap-name">
      📍 {lat.toFixed(2)}, {lng.toFixed(2)}
    </div>
  );
}

function fmt(v, suffix = "", digits = 1) {
  if (v == null || isNaN(v)) return "–";
  return Number(v).toFixed(digits) + suffix;
}

function formatLocalHour(isoString) {
  if (!isoString) return "–";
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatWeekday(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString([], { weekday: "short" });
}

/* Onko slottien välillä vuorokausiraja? (ensimmäinen rivi saa aina päivän,
   jos se ei ole tänään) */
function dayChanged(prevIso, currIso) {
  if (!currIso) return false;
  const curr = new Date(currIso);
  if (!prevIso) {
    return curr.toDateString() !== new Date().toDateString();
  }
  return new Date(prevIso).toDateString() !== curr.toDateString();
}

/* Paras ikkuna: näyttää viikonpäivän jos ikkuna ei ole tänään,
   esim. "la 21:00–01:00" */
function formatWindowRange(startIso, endIso) {
  if (!startIso) return "–";
  const start = new Date(startIso);
  const today = start.toDateString() === new Date().toDateString();
  const day = today ? "" : start.toLocaleDateString([], { weekday: "short" }) + " ";
  return `${day}${formatLocalHour(startIso)}–${formatLocalHour(endIso)}`;
}

/* Kp → taso. Samat rajat kuin workerin kpToLevel-funktiossa, jotta kartta
 * ja backend eivät kerro eri tarinaa samasta luvusta. */
function kpLevel(kp) {
  if (kp == null || isNaN(kp)) return "low";
  if (kp >= 7) return "veryhigh";
  if (kp >= 5) return "high";
  if (kp >= 4) return "medium";
  return "low";
}

function probabilityToLevel(probability) {
  if (probability == null || isNaN(probability)) return "low";
  if (probability >= 75) return "veryhigh";
  if (probability >= 50) return "high";
  if (probability >= 25) return "medium";
  return "low";
}

function levelColor(level) {
  return { low: "#888", medium: "#ffe600", high: "#00ff88", veryhigh: "#ff3b7f" }[level] || "#888";
}