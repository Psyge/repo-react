import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useTranslation from "../hooks/useTranslation";
import { calculateAurora } from "../utils/auroraEngine";
import staticPlaces from "../data/places";
import { client } from "../lib/contentfulClient";
import HeroTop from "./HeroTop";
import HeroForecast from "./HeroForecast";
import HeroPlaces from "./HeroPlaces";
import { saveUserLocation } from "../utils/userLocation";
import AdRotator from "./AdRotator";

/* ========================================================================
   AuroraHero — dashboard-tyylinen etusivun hero
   Vasen palsta: mittarit → Kp-ennuste → "Näen revontulia" -toimintarivi
   Oikea palsta: Paikat (4 satunnaista per sivulataus)
======================================================================= */

/* HUOM: aurinkotuuli, Bz ja Kp tulevat nyt workerin forecast.current-lohkosta,
 * ei suoraan NOAA:lta. Worker hoitaa varalähteet (GFZ Potsdam), tuoreusvahdin
 * ja vanhentuneen datan ikämerkinnän. Yksi totuuden lähde. */
const BASE = process.env.REACT_APP_API_BASE || "";
const WEATHER_TTL_MS       = 60 * 60 * 1000;
const THREE_LOAD_TIMEOUT_MS = 4000;

/* Graafin mitat — pehmennykset reunoilla akseleita varten */
const WAVE_W = 760;
const WAVE_H = 150;
const WAVE_PAD = { l: 34, r: 12, t: 14, b: 22 };

/* Graafin aikaikkunan valinta (1 vrk free / 3 vrk premium) */
const RANGE_KEY = "hero_wave_range_v1";

/* Montako paikkaa näytetään Paikat-paneelissa (arvotaan per sivulataus) */
const FEATURED_PLACES_COUNT = 4;

/* ---- lokalisoidun Contentful-kentän purku ---- */
function getField(field, lang) {
  if (!field) return "";
  if (typeof field === "object" && !Array.isArray(field)) {
    return field[lang] || field["fi-FI"] || field["en-US"] || Object.values(field)[0] || "";
  }
  return field;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

/* ---- session cache ---- */
function readSessionCache(key, ttlMs) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached.savedAt !== "number") return null;
    if (ttlMs && Date.now() - cached.savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return cached.data ?? null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}
function writeSessionCache(key, data) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {}
}
/* ---- paikkakohtainen pilvisyys (Open-Meteo, YKSI batch-kutsu) ---- */
function placesWeatherCacheKey(places) {
  return `aurora_session_cache:hero:weather-all:${places.length}:v1`;
}
/* Rinnakkaisten kutsujen dedupe: tuplamount (esim. StrictMode) ei enää
   käynnistä kahta hakua, joista väärä voittaa → pilvet näkyvät heti.
   Lisäksi yksi automaattinen uusintayritys jos fetch epäonnistuu. */
let inflightWeather = null;

async function fetchAllPlacesWeather(places) {
  if (!places.length) return {};
  const key = placesWeatherCacheKey(places);

  const cached = readSessionCache(key, WEATHER_TTL_MS);
  if (cached) return cached;

  if (inflightWeather) return inflightWeather;

  inflightWeather = (async () => {
    try {
      /* Haetaan omalta workerilta, EI suoraan Open-Meteosta. Worker hakee
         kaikkien paikkojen säät yhdellä niputetulla kutsulla cronissa —
         aiemmin jokainen selain teki oman kutsunsa sivulatauksella. */
      const res = await fetch(`${BASE}/api/places/weather`);
      if (!res.ok) throw new Error(`places weather ${res.status}`);

      const data = await res.json();
      const map = data?.places || {};

      /* Älä cachea kokonaan tyhjää tulosta — muuten viivat jäisivät
         näkyviin tunniksi vaikka seuraava yritys onnistuisi */
      const hasData = Object.values(map).some((v) => v && v.clouds != null);
      if (hasData) writeSessionCache(key, map);
      return map;
    } finally {
      inflightWeather = null;
    }
  })();

  return inflightWeather;
}

function shouldEnhanceWith3D() {
  if (typeof window === "undefined") return false;
  const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  if (rm && rm.matches) return false;
  const conn = navigator.connection || navigator.webkitConnection || {};
  if (conn.saveData) return false;
  if (conn.effectiveType && !/4g/i.test(conn.effectiveType)) return false;
  const cores = navigator.hardwareConcurrency;
  if (cores && cores < 4) return false;
  try {
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl2") || cv.getContext("webgl");
    if (!gl) return false;
  } catch { return false; }
  return true;
}

function nextAwakening(slots) {
  if (!Array.isArray(slots) || !slots.length) return null;
  const now = Date.now();
  const upcoming = slots
    .map((s) => ({ ...s, ms: Date.parse(s.tsUtc) }))
    .filter((s) => !Number.isNaN(s.ms) && s.ms > now)
    .sort((a, b) => a.ms - b.ms);

  const hit = upcoming.find((s) => (s.kp ?? 0) >= 4 || s.level === "high" || s.level === "veryhigh");
  if (!hit) return null;
  const hours = Math.max(1, Math.round((hit.ms - now) / 3_600_000));
  return { hours, kp: hit.kp };
}

/* NOAA:n G-myrskyluokitus Kp:stä (kansainvälinen asteikko, ei lokalisoida) */
function kpStormLabel(kp) {
  if (kp == null) return null;
  if (kp >= 9) return "G5 Geomagnetic Storm";
  if (kp >= 8) return "G4 Geomagnetic Storm";
  if (kp >= 7) return "G3 Geomagnetic Storm";
  if (kp >= 6) return "G2 Geomagnetic Storm";
  if (kp >= 5) return "G1 Geomagnetic Storm";
  return null;
}

/* Pehmennetty polku (cubic bezier) — polyline näyttää kulmikkaalta */
function smoothPath(pts) {
  if (!pts.length) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const dx = (x1 - x0) / 3;
    d += ` C ${(x0 + dx).toFixed(1)} ${y0.toFixed(1)}, ${(x1 - dx).toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

/* Rakentaa Kp-ennustegraafin datan valitulle aikaikkunalle. */
function buildWave(slots, locale, horizonHours) {
  if (!Array.isArray(slots) || slots.length < 2) return null;

  const now = Date.now();
  const cutoff = now + horizonHours * 60 * 60 * 1000;
  const pts = slots
    .map((s) => ({ ms: Date.parse(s.tsUtc), kp: s.kp ?? 0 }))
    .filter((s) => !Number.isNaN(s.ms) && s.ms >= now - 3 * 60 * 60 * 1000 && s.ms <= cutoff)
    .sort((a, b) => a.ms - b.ms);
  if (pts.length < 2) return null;

  const t0 = pts[0].ms;
  const t1 = pts[pts.length - 1].ms;
  const span = Math.max(1, t1 - t0);
  const maxKp = 9;

  const innerW = WAVE_W - WAVE_PAD.l - WAVE_PAD.r;
  const innerH = WAVE_H - WAVE_PAD.t - WAVE_PAD.b;
  const x = (ms) => WAVE_PAD.l + ((ms - t0) / span) * innerW;
  const y = (kp) => WAVE_PAD.t + innerH - (Math.min(kp, maxKp) / maxKp) * innerH;
  const baseY = WAVE_PAD.t + innerH;

  const linePts = pts.map((p) => [x(p.ms), y(p.kp)]);

  const areaPath =
    `${smoothPath(linePts)} L ${linePts[linePts.length - 1][0].toFixed(1)} ${baseY} L ${linePts[0][0].toFixed(1)} ${baseY} Z`;

  const yTicks = [0, 3, 6, 9].map((kp) => ({ y: y(kp), kp }));

  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const dayTicks = [];
  const d0 = new Date(t0);
  d0.setHours(24, 0, 0, 0);
  for (let ms = d0.getTime(); ms < t1; ms += 24 * 60 * 60 * 1000) {
    dayTicks.push({ x: x(ms), label: dayFmt.format(ms) });
  }

  const peakSrc = pts.reduce((a, b) => (b.kp > a.kp ? b : a));
  const peak = { x: x(peakSrc.ms), y: y(peakSrc.kp), kp: peakSrc.kp };

  const nowX = now >= t0 && now <= t1 ? x(now) : null;

  return {
    openPath: smoothPath(linePts),
    areaPath,
    yTicks,
    dayTicks,
    peak,
    baseY,
    nowX,
  };
}

/* Mittarikortti (aurinkotuuli/pilvet/Kp).
 * children = vapaa lisäsisältö kortin alaosaan: toinen arvo tai Kp-palkki. */
function MetricCard({ label, value, unit, delta, deltaUnit, deltaSuffix, children }) {
  const dir = delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  /* Alarivi näytetään myös ilman delta-arvoa, koska se kantaa nykyään
     ikämerkinnän ("15 vrk vanha"). Aiemmin ehto oli pelkkä delta != null,
     jolloin merkintä jäi näkymättä kun worker lakkasi palauttamasta deltoja. */
  const showFooter = delta != null || !!deltaSuffix;
  return (
    <div className="ah-metric">
      <span className="ah-metric-label">{label}</span>
      <span className="ah-metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {showFooter && (
        <span className={`ah-metric-delta ${dir ? `ah-metric-delta--${dir}` : "ah-metric-delta--none"}`}>
          {delta != null && (
            <>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {delta > 0 ? "+" : ""}{delta}{deltaUnit}{" "}
            </>
          )}
          {deltaSuffix}
        </span>
      )}
      {children}
    </div>
  );
}

/* ======================================================================== */
export default function AuroraHero({ forecast, children }) {
  const navigate = useNavigate();
  const { currentLanguage, t } = useTranslation();

  const slots = useMemo(() => forecast?.slots ?? [], [forecast]);
  const tier  = forecast?.tier ?? "free";
  const isPremium = tier === "premium";

  const [kp, setKp]     = useState(null);
  const [wind, setWind] = useState(null);
  const [bz, setBz]     = useState(null);
  /* Delta-arvot (muutos tunnin yli) poistettu: ne laskettiin aiemmin
     selaimessa NOAA:n feedistä, ja worker ei palauta niitä. Jos haluat ne
     takaisin, worker voisi laskea ne propagated-feedin ikkunasta ja
     palauttaa current.speedDelta / current.bzDelta. */
  const [threeReady, setThreeReady] = useState(false);

  const [contentfulPlaces, setContentfulPlaces] = useState([]);
  const [placeWeather, setPlaceWeather] = useState({}); // { [id]: { clouds, temp } }

  /* Aikaikkuna: 1 vrk (free & premium) / 3 vrk (vain premium). */
  const [range, setRange] = useState(() => {
    try {
      const v = localStorage.getItem(RANGE_KEY);
      return v === "1d" || v === "3d" ? v : "3d";
    } catch { return "3d"; }
  });
  const effectiveRange = isPremium ? range : "1d";
  const horizonHours = effectiveRange === "1d" ? 24 : 72;

  const selectRange = (key) => {
    if (key === "3d" && !isPremium) {
      navigate("/premium");
      return;
    }
    setRange(key);
    try { localStorage.setItem(RANGE_KEY, key); } catch {}
  };

  const lang = currentLanguage === "en" ? "en-US" : "fi-FI";
  const locale = currentLanguage === "en" ? "en-GB" : "fi-FI";

  /* Käännös fallbackilla — jos avainta ei ole, käytä annettua tekstiä */
  const trh = (key, fi, en) => {
    const s = t(key);
    if (s != null && s !== key) return s;
    return currentLanguage === "en" ? en : fi;
  };

  /* Contentful-paikat (Content Type: place) */
  useEffect(() => {
    client.withAllLocales
      .getEntries({ content_type: "place", limit: 100 })
      .then((response) => setContentfulPlaces(response.items || []))
      .catch((err) => console.error("Contentful places error:", err));
  }, []);

  /* Paikkakohtainen pilvisyys Open-Meteosta — yksi batch-kutsu.
     Jos haku epäonnistuu tai palauttaa tyhjää, yritetään vielä
     2 kertaa 4 s välein — ei jäädä "--"-tilaan ilman refreshiä. */
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const load = () => {
      fetchAllPlacesWeather(staticPlaces)
        .then((map) => {
          if (cancelled) return;
          const hasData =
            map && Object.values(map).some((v) => v && v.clouds != null);
          if (hasData) { setPlaceWeather(map); return; }
          throw new Error("empty weather map");
        })
        .catch((e) => {
          console.warn("Open-Meteo batch failed:", e);
          if (!cancelled && tries < 2) {
            tries += 1;
            setTimeout(load, 4000);
          }
        });
    };
    load();
    return () => { cancelled = true; };
  }, []);

  /* Yhdistetään: staattiset paikat + globaali Kp/tuuli + paikan pilvisyys + Contentful-teksti */
  const placesList = useMemo(() => {
    return staticPlaces.map((sp) => {
      const w = placeWeather[sp.id];
      const localKp     = kp ?? null;
      const localWind   = wind ?? 400;
      const localClouds = w?.clouds ?? null;

      const cfMatch = contentfulPlaces.find((item) => {
        const slugField = item?.fields?.slug;
        const vals = (slugField && typeof slugField === "object")
          ? Object.values(slugField)
          : [slugField];
        return vals.some(
          (v) => v != null && String(v).toLowerCase() === String(sp.slug).toLowerCase()
        );
      });

      const localAurora = calculateAurora({
        kp: localKp ?? 0,
        speed: localWind,
        density: 5,
        bz: bz ?? 0,
        cloudCover: localClouds ?? 50,
        latitude: sp.lat,
      });

      const rawDescription =
        cfMatch?.fields?.short ||
        cfMatch?.fields?.description ||
        cfMatch?.fields?.desc;
      const description = getField(rawDescription, lang);

      const rawName = cfMatch?.fields?.name || cfMatch?.fields?.title;
      const displayName = getField(rawName, lang) || sp.name;

      return {
        ...sp,
        name: displayName,
        description,
        prob: localAurora?.probability ?? 0,
        currentKp: localKp,
        currentClouds: localClouds,
        currentTemp: w?.temp ?? null,
      };
    });
  }, [contentfulPlaces, placeWeather, kp, wind, bz, lang]);

  const [activePlace, setActivePlace] = useState(null);

  /* Aina tuorein placesList async-callbackeja varten (esim. geolocation,
     joka voi ratketa vasta sekunteja myöhemmin käyttäjän hyväksyttyä
     selaimen lupakyselyn) — estää vanhentuneen datan käytön. */
  const placesListRef = useRef(placesList);
  useEffect(() => {
    placesListRef.current = placesList;
  }, [placesList]);

  useEffect(() => {
    if (placesList.length > 0) {
      setActivePlace((prev) => {
        if (prev) {
          const updated = placesList.find((p) => p.id === prev.id);
          if (updated) return updated;
        }
        return placesList[0];
      });
    }
  }, [placesList]);

  /* Paikat-paneeli: arvotaan per sivulataus 4 paikkaa. Valinta tehdään
     kerran mountissa (id-lista), data päivittyy placesListin mukana. */
  const [featuredIds] = useState(() =>
    [...staticPlaces]
      .sort(() => Math.random() - 0.5)
      .slice(0, FEATURED_PLACES_COUNT)
      .map((p) => p.id)
  );
  const featuredPlaces = useMemo(
    () => placesList.filter((p) => featuredIds.includes(p.id)),
    [placesList, featuredIds]
  );

  const canvasRef = useRef(null);
  const skyRef    = useRef(null);
  const probRef   = useRef(null);

  /* Aurinkotuuli ja Bz workerin current-lohkosta.
   *
   * Aiemmin tämä haki NOAA:n propagated-feedin suoraan selaimesta omalla
   * vanhenemisvahdillaan. Se rikkoutui kun NOAA jäätyi kesällä 2026 eikä
   * hyötynyt workerin varalähteistä. Nyt on yksi totuuden lähde. */
  useEffect(() => {
    const c = forecast?.current;
    if (!c) return;
    setWind(c.speed ?? null);
    setBz(c.bz ?? null);
  }, [forecast]);

  /* Nykyinen Kp = MITATTU arvo workerin current-lohkosta (GFZ Potsdam).
   *
   * EI varapolkua ennustesarjaan. Aiemmin tässä poimittiin lähin slotti jos
   * current.kp puuttui, jolloin heron "Kp-indeksi" näytti NOAA:n ENNUSTETTA
   * mitattuna arvona. Ne ovat eri asioita: NOAA saattaa ennustaa 4.3 samalle
   * jaksolle jolle GFZ mittaa 1.0, ja ennusteen esittäminen havaintona on
   * harhaanjohtavaa. Ennuste näkyy jo omassa graafissaan otsikolla
   * "Kp-ennuste". Jos mitattua arvoa ei ole, näytetään viiva.
   *
   * Nolla on myös kelvollinen Kp-arvo (täysin rauhallinen), joten sitä ei
   * kohdella puuttuvana. */
  useEffect(() => {
    const v = forecast?.current?.kp;
    /* Kp on aina 0–9. Asteikon ulkopuolinen luku (esim. -1 = puuttuva arvo)
     * on virhe, ei mittaus — näytetään mieluummin viiva kuin väärä luku. */
    const valid = typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 9;
    setKp(valid ? v : null);
  }, [forecast]);

  /* Mistä näytettävä Kp on peräisin: 'gfz' = mitattu, 'noaa' = ennustesarjasta
   * otettu vara-arvo. Null kun arvoa ei näytetä lainkaan. */
  const kpSource = kp != null ? (forecast?.current?.kpSource ?? null) : null;

  /* Muotoilee iän tunneista tekstiksi.
   *
   * HUOM paikkamerkeistä: kielitiedostoissa arvot ovat "{h} h vanha" ja
   * "{d} vrk vanha", mutta trh palauttaa käännöksen SELLAISENAAN eikä osaa
   * korvata paikkamerkkejä. Ilman replacea ruudulle tuli kirjaimellisesti
   * "{h} h vanha". Fallback-teksteissä luku on jo valmiina, joten replace
   * on niiden kohdalla harmiton no-op. */
  const ageText = (hours) => {
    if (hours < 48) {
      return trh("data.ageHours", `${hours} h vanha`, `${hours} h old`)
        .replace("{h}", hours);
    }
    const d = Math.round(hours / 24);
    return trh("data.ageDays", `${d} vrk vanha`, `${d} d old`).replace("{d}", d);
  };

  /* Vanhentunut aurinkotuulidata näytettäväksi ikämerkinnän kanssa */
  const staleWind = forecast?.current?.stale ?? null;
  const staleAgeText = useMemo(() => {
    const ms = staleWind?.ageMs;
    if (!ms || !Number.isFinite(ms)) return null;
    return ageText(Math.round(ms / 3600000));
  }, [staleWind, currentLanguage]);   // eslint-disable-line react-hooks/exhaustive-deps

  /* Kp:n ikä. Kp on kolmen tunnin indeksi, joten tuorekin arvo on lähes
   * aina 0–3 h vanha — se on normaalia eikä sitä kannata korostaa. Merkintä
   * näytetään vasta kun arvo on yli 3 h vanha, jolloin jokin on pielessä.
   *
   * Tämä on suora vastaus 8/2026 vikaan: sivu näytti yli vuorokauden vanhaa
   * Kp-arvoa, eikä sitä voinut mitenkään huomata itse sivulta katsomalla. */
  const kpAgeText = useMemo(() => {
    const ts = forecast?.current?.kpTs;
    if (kp == null || !ts || !Number.isFinite(ts)) return null;
    const h = Math.round((Date.now() - ts) / 3600000);
    if (h <= 3) return null;
    return ageText(h);
  }, [forecast, kp, currentLanguage]);   // eslint-disable-line react-hooks/exhaustive-deps

  const aurora = useMemo(
    () => calculateAurora({ kp, speed: wind, density: 5, bz, cloudCover: 50, latitude: activePlace?.lat || 66.5 }),
    [kp, wind, bz, activePlace]
  );
  const probability = aurora?.probability ?? null;
  probRef.current = probability;

  const awakening = useMemo(() => nextAwakening(slots), [slots]);
  const wave = useMemo(
    () => buildWave(slots, locale, horizonHours),
    [slots, locale, horizonHours]
  );

  const kpStep = useMemo(() => {
    if (kp == null || kp < 1.5) return 0;
    if (kp < 3.5) return 1;
    if (kp < 5.5) return 2;
    return 3;
  }, [kp]);

  const targetIntensity = useMemo(() => {
    if (kpStep === 0) return 0.0;
    if (kpStep === 1) return 0.25;
    if (kpStep === 2) return 0.60;
    return 1.0;
  }, [kpStep]);

  /* GPS → lähin piste aktiiviseksi.
     HUOM: pyydetään sijainti VAIN KERRAN (geoRequestedRef-vartija).
     Ilman tätä efekti käynnistäisi getCurrentPosition-kutsun uudelleen
     joka kerta kun placesList muuttuu (esim. säädatan latautuessa),
     jolloin selain jonottaa useita pyyntöjä lupakyselyn taakse — ja kun
     käyttäjä hyväksyy sen, jokin vanhoista (mahdollisesti ennen
     säädatan latautumista otetuista) callbackeista voi ratketa
     viimeisenä ja ylikirjoittaa jo oikein täyttyneen activePlacen
     pilvettömällä versiolla. Käytetään placesListRef.currentia, jotta
     callback näkee aina tuoreimman datan riippumatta siitä milloin
     selain lopulta vastaa. */
  const geoRequestedRef = useRef(false);
  useEffect(() => {
    if (geoRequestedRef.current) return;
    if (typeof window === "undefined" || !navigator.geolocation) return;
    if (placesList.length === 0) return;
    geoRequestedRef.current = true;

    navigator.geolocation.getCurrentPosition((position) => {
      const list = placesListRef.current;
      if (!list.length) return;
      const uLat = position.coords.latitude;
      const uLon = position.coords.longitude;
      /* Jaetaan muille komponenteille (LiveCamSpotlight) — näin niiden ei
         tarvitse pyytää sijaintilupaa uudelleen. */
      saveUserLocation(uLat, uLon);
      let closest = list[0];
      let minDst = getDistance(uLat, uLon, list[0].lat, list[0].lon);
      list.forEach((p) => {
        const dst = getDistance(uLat, uLon, p.lat, p.lon);
        if (dst < minDst) { minDst = dst; closest = p; }
      });
      setActivePlace(closest);
    });
  }, [placesList]);

  /* Three.js taivas */
  useEffect(() => {
    if (!shouldEnhanceWith3D()) return;
    let cancelled = false;
    let tooLate = false;
    const timer = setTimeout(() => { tooLate = true; }, THREE_LOAD_TIMEOUT_MS);

    import("../utils/auroraSky")
      .then(({ createAuroraSky }) => {
        if (cancelled || tooLate || !canvasRef.current) return;
        skyRef.current = createAuroraSky(canvasRef.current, { intensity: targetIntensity });
        setThreeReady(true);
      })
      .catch((e) => console.warn(e));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (skyRef.current) { skyRef.current.destroy(); skyRef.current = null; }
    };
  }, [targetIntensity]);

  useEffect(() => {
    if (skyRef.current) skyRef.current.setIntensity(targetIntensity);
  }, [targetIntensity]);

  const calm = kpStep <= 1;
  const isActive = kpStep >= 2;

  const headline = calm ? t("aurora.calm") : t("aurora.active");
  const nextLine = isPremium && awakening
    ? String(t("aurora.next")).replace("{h}", awakening.hours)
    : (!calm ? "" : t("aurora.quiet"));

  /* Sanallinen tuomio todennäköisyydestä — sama kynnys kuin workerin
     computeAurora-funktiolla (75/50/25). Tämä on heron pääviesti: käyttäjä
     kysyy "kannattaako valvoa", ei "mikä on Kp". */
  const verdict = useMemo(() => {
    if (probability == null) {
      return trh("hero.verdict.unknown", "Tilannetta ei juuri nyt saatavilla", "Conditions unavailable right now");
    }
    if (probability >= 75) return trh("hero.verdict.veryhigh", "Erinomainen mahdollisuus nähdä revontulia", "Excellent chance of seeing the northern lights");
    if (probability >= 50) return trh("hero.verdict.high",     "Hyvä mahdollisuus nähdä revontulia",        "Good chance of seeing the northern lights");
    if (probability >= 25) return trh("hero.verdict.medium",   "Revontulet ovat mahdollisia",                "The northern lights are possible");
    return trh("hero.verdict.low", "Revontulia tuskin näkyy tänä yönä", "The northern lights are unlikely tonight");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probability, currentLanguage]);

  /* Päivitysaika eyebrow'hun — hyödyllisempi kuin mittaristotermit,
     varsinkin kun lähteet voivat olla jäässä. */
  const updatedText = useMemo(() => {
    const ts = Date.parse(forecast?.genAt || "");
    if (!Number.isFinite(ts)) return null;
    const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (min < 1) return trh("hero.updatedNow", "Päivitetty juuri äsken", "Updated just now");
    return trh("hero.updatedAgo", `Päivitetty ${min} min sitten`, `Updated ${min} min ago`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast, currentLanguage]);

  const storm = kpStormLabel(kp);

  return (
    <section className={`aurora-hero-container ah-hero--dash ${threeReady ? "three-active" : ""} ${isActive ? "is-active" : ""} kp-step-${kpStep}`}>

      <div className="ah-sky-wrap">
        {kpStep > 0 && <div className="ah-sky--css" aria-hidden="true" />}
        <canvas ref={canvasRef} className="ah-canvas" aria-hidden="true" />
      </div>

      {/* CSS-revontuliverhot + tähdet (aina näkyvissä, hienovaraiset) */}
      <div className="ah-ambient" aria-hidden="true" />

      <div className="ah-dash">
        <div className="ah-adrotator-slot">
          <AdRotator />
        </div>

        {/* Ylärivi: iso Kp + tila vasemmalla, globe oikealla */}
        <HeroTop
          placeName={activePlace?.name || null}
          verdict={verdict}
          probability={probability}
          updatedText={updatedText}
          headline={headline}
          nextLine={nextLine}
          storm={storm}
          isPremium={isPremium}
          navigate={navigate}
          t={t}
          trh={trh}
        />

        {/* Alarivi: vasen palsta (mittarit → graafi → toimintarivi),
            oikea palsta (paikat) */}
        <div className="ah-dash-grid">
          <div className="ah-dash-main">

            {/* Mittarikortit — samat arvot kaikille (julkista dataa) */}
            <div className="ah-metrics">
              {/* Aurinkotuuli ja Bz ovat saman mittauksen kaksi puolta eivätkä
                  kumpikaan kerro maallikolle mitään yksinään → yksi kortti.
                  Kun mittaus on liian vanha laskentaan, näytetään viimeisin
                  tunnettu arvo ikämerkinnällä viivan sijaan. Arvo EI ole
                  mukana todennäköisyyslaskennassa. */}
                  <MetricCard
                label={
                  trh("hero.metric.kp", "Kp-indeksi", "Kp index") +
                  /* Kun GFZ ei vastaa, worker ottaa arvon NOAA:n 3 vrk
                     -ennustesarjasta. Se on ENNUSTE, ei mittaus — merkitään
                     näkyviin, ettei lukua luulla havainnoksi. */
                  (kpSource === "noaa"
                    ? ` (${trh("hero.metric.kpForecast", "ennuste", "forecast")})`
                    : "")
                }
                value={kp != null ? kp.toFixed(1) : "–"}
                delta={null}
                deltaSuffix={kpAgeText}
              >
                <div className="ah-kp-bar ah-kp-bar--compact">
                  <div className="ah-kp-bar-track">
                    <div
                      className="ah-kp-bar-fill"
                      style={{ width: `${Math.min(((kp ?? 0) / 9) * 100, 100)}%` }}
                    />
                    <span
                      className="ah-kp-bar-storm-mark"
                      title={trh("hero.stormMark", "Myrskyraja (Kp 5 = G1)", "Storm threshold (Kp 5 = G1)")}
                    />
                  </div>
                  <div className="ah-kp-bar-scale">
                    <span>0</span><span>3</span><span>6</span><span>9</span>
                  </div>
                </div>
              </MetricCard>
              <MetricCard
                label={trh("hero.metric.solarwind", "Aurinkotuuli", "Solar wind")}
                value={
                  wind != null ? Math.round(wind)
                  : staleWind?.speed != null ? Math.round(staleWind.speed)
                  : "–"
                }
                unit="km/s"
                deltaSuffix={wind == null && staleWind?.speed != null ? staleAgeText : null}
              >
                <span className="ah-metric-second">
                  Bz{" "}
                  <strong>
                    {bz != null ? bz.toFixed(1)
                     : staleWind?.bz != null ? staleWind.bz.toFixed(1)
                     : "–"}
                  </strong>
                  <small> nT</small>
                  {bz == null && staleWind?.bz != null && staleAgeText && (
                    <em className="ah-metric-age"> · {staleAgeText}</em>
                  )}
                </span>
              </MetricCard>
              <MetricCard
                label={`${trh("hero.metric.clouds", "Pilvisyys", "Cloud Cover")}${activePlace ? ` · ${activePlace.name}` : ""}`}
                value={activePlace?.currentClouds != null ? activePlace.currentClouds : "–"}
                unit="%"
                delta={null}
              />

              {/* Kp siirtyi tänne heron pääpaikalta: se on mittausarvo siinä
                  missä tuuli ja pilvetkin, ei se mitä käyttäjä haluaa tietää. */}
              
            </div>

            {/* Kp-ennustegraafi */}
            <HeroForecast
              wave={wave}
              forecast={forecast}
              effectiveRange={effectiveRange}
              isPremium={isPremium}
              selectRange={selectRange}
              trh={trh}
              WAVE_W={WAVE_W}
              WAVE_H={WAVE_H}
              WAVE_PAD={WAVE_PAD}
            />

            {/* "Näen revontulia" -toimintarivi — graafin alla, huomiota
                herättävä (tyylit .ah-see-strip) */}
            {children && (
              <div className="ah-see-strip">
                {!isPremium && (
                  <div className="ah-spin-teaser">
                    🎰 {t("spin.teaser") ||
                      "Spotted the lights? Report a sighting and spin to win free Premium."}
                  </div>
                )}
                {children}
              </div>
            )}
          </div>

          {/* Oikea palsta: kesäkortti, kamera, paikkalista ja paikan popup.
              Popupin tila asuu HeroPlacesissa, koska mikään muu ei tarvitse sitä. */}
          <HeroPlaces
            featuredPlaces={featuredPlaces}
            activePlace={activePlace}
            setActivePlace={setActivePlace}
            currentKp={kp}
            trh={trh}
          />
        </div>
      </div>
    </section>
  );
}