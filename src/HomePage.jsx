import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "./components/Header";
import Aurorahero from "./components/Aurorahero";
import Sightings from "./components/Sightings";


import useTranslation from "./hooks/useTranslation";


import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient";


const BASE = process.env.REACT_APP_API_BASE || "";

/* NOAA-haku ja -jäsennys poistettu: ennuste tulee nyt workerilta, joka
   hoitaa varalähteet (GFZ) ja tuoreusvahdin. Ks. fetchFreeForecast. */
const FREE_FORECAST_CACHE_KEY = "aurora_session_cache:home:forecast:free:v1";
const FORECAST_TTL_MS = 15 * 60 * 1000;

function readDeviceKey() {
  try {
    const p = JSON.parse(localStorage.getItem("aurora_premium") || "null");
    if (!p || !p.deviceKey || !p.expiresAt) return "";
    if (p.expiresAt < Date.now()) return "";
    return p.deviceKey;
  } catch {
    return "";
  }
}

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

async function sessionCachedJson(key, ttlMs, fetcher) {
  const cached = readSessionCache(key, ttlMs);
  if (cached) return cached;
  const data = await fetcher();
  writeSessionCache(key, data);
  return data;
}

/* Ilmaisennuste workerilta, EI suoraan NOAA:lta.
 *
 * Aiemmin tämä haki ja jäsensi NOAA:n 3-day-forecast.txt -tiedoston
 * selaimessa. Se rikkoutui kun NOAA:n feedit jäätyivät kesällä 2026, eikä
 * hyötynyt workerin varalähteistä. Worker hakee Kp:n GFZ Potsdamilta kun
 * NOAA on nurin, hoitaa tuoreusvahdin ja kertoo lipulla jos ennuste puuttuu. */
async function fetchFreeForecast() {
  return sessionCachedJson(FREE_FORECAST_CACHE_KEY, FORECAST_TTL_MS, async () => {
    const res = await fetch(`${BASE}/api/aurora/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 67.5, lon: 26 }),
    });
    if (!res.ok) throw new Error(`Forecast ${res.status}`);
    const data = await res.json();
    return {
      tier:    data?.tier    || "free",
      slots:   Array.isArray(data?.slots) ? data.slots : [],
      genAt:   data?.genAt   || null,
      current: data?.current || null,
      forecastUnavailable: data?.forecastUnavailable === true,
    };
  });
}

async function fetchPremiumForecast(deviceKey) {
  const cacheKey = `aurora_session_cache:home:forecast:premium:${deviceKey.slice(0, 12)}:v1`;
  return sessionCachedJson(cacheKey, FORECAST_TTL_MS, async () => {
    const res = await fetch(`${BASE}/api/aurora/forecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 67.5, lon: 26, deviceKey }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Forecast ${res.status}: ${text.slice(0, 120)}`);
    }
    const data = await res.json().catch(() => {
      throw new Error("Forecast: invalid JSON");
    });
    return {
      tier:    data?.tier    || "premium",
      slots:   Array.isArray(data?.slots) ? data.slots : [],
      genAt:   data?.genAt   || null,
      current: data?.current || null,
      forecastUnavailable: data?.forecastUnavailable === true,
    };
  });
}

// Purkaa lokalisoitu Contentful-kenttä oikean kielen stringiksi
function getField(field, lang) {
  if (!field) return "";
  if (typeof field === "object" && !Array.isArray(field)) {
    return field[lang] || field["fi-FI"] || "";
  }
  return field;
}

export default function HomePage() {
  const [forecast, setForecast] = useState({
    tier: "free", slots: [], genAt: null, current: null,
    forecastUnavailable: false,
  });
  const [articles, setArticles] = useState([]);
  const { t, currentLanguage } = useTranslation();

  useEffect(() => {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2500));
  idle(() => import("./components/Globeview").then((m) => m.preloadGlobeAssets()));
}, []);

  // EFEKTI 1: Ennusteen lataus
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const deviceKey = readDeviceKey();
        const data = deviceKey
          ? await fetchPremiumForecast(deviceKey)
          : await fetchFreeForecast();
        if (cancelled) return;
        setForecast({
          tier:    data?.tier    || "free",
          slots:   Array.isArray(data?.slots) ? data.slots : [],
          genAt:   data?.genAt   || null,
          current: data?.current || null,
          forecastUnavailable: data?.forecastUnavailable === true,
        });
      } catch (e) {
        console.error("FORECAST ERROR:", e);
        if (cancelled) return;
        setForecast((prev) =>
          prev.slots.length
            ? prev
            : { tier: "free", slots: [], genAt: null, current: null, forecastUnavailable: true }
        );
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // EFEKTI 2: Contentful-artikkeleiden lataus
  useEffect(() => {
    let cancelled = false;
    const lang = currentLanguage === "en" ? "en-US" : "fi-FI";

    // withAllLocales → kentät tulevat objekteina { 'fi-FI': '...', 'en-US': '...' }
    // → getField purkaa oikean kielen → toimii kieltä vaihtaessa
    client.withAllLocales
      .getEntries({ content_type: "post", limit: 3 })
      .then((response) => {
        if (cancelled) return;
        const localized = response.items.map((item) => ({
          ...item,
          fields: {
            ...item.fields,
            title:   getField(item.fields.title,   lang),
            excerpt: getField(item.fields.excerpt, lang),
            slug:    getField(item.fields.slug,    lang),
          },
        }));
        setArticles(localized);
      })
      .catch((err) =>
        console.error("Virhe etusivun artikkeleiden haussa:", err)
      );

    return () => { cancelled = true; };
  }, [currentLanguage]);

  return (
    <div>
      <SEO
        title="Northern Lights Forecast Finland | RepoTracker"
        description="Live Northern Lights forecast, KP index, solar wind and northern lights map for Finland and Lapland."
        keywords="northern lights, aurora forecast, Finland, Lapland, KP index"
        canonical="https://repotracker.fi/"
      />

      <Header />
      
      <main>
        
        {/* HERO */}
       <Aurorahero forecast={forecast}>
  
   
  <Sightings />
</Aurorahero>

      

        {/* ARTICLES */}
        <section className="block">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>{t("home.articles.title")}</h2>
                <p>{t("home.articles.sub")}</p>
              </div>
            </div>

            <div className="home-articles">
              {articles.map((article) => (
                <Link
                  key={article.sys.id}
                  to={`/blog/${article.fields.slug}`}
                  className="blog-card"
                >
                  <h2>{article.fields.title}</h2>
                  <p>{article.fields.excerpt}</p>
                  <div className="blog-card-read">{t("blog.read")}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

   <footer className="footer">
  {/* 1. Yhteistyöosio siististi ylhäällä */}
  <div className="footer-coop" style={{ marginBottom: "1.5rem", textAlign: "center" }}>
    <p className="footer-coop-title" style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
      🤝 {t("coop_title")}
    </p>
    <p className="footer-coop-text">
      {t("coop_text")}{" "}
      <Link to="/contact" className="footer-coop-link" style={{ color: "#00ffc6", textDecoration: "underline" }}>
        {t("footer.contact") || "Contact"}
      </Link>
    </p>
  </div>

  {/* 2. Lakilinkit ja copyright omalla rivillään aivan alhaalla */}
  <div className="footer-bottom" style={{ textAlign: "center", opacity: 0.6, fontSize: "0.9rem" }}>
    <p style={{ marginBottom: "0.5rem" }}>© RepoTracker</p>
    <div className="footer-links">
      <Link to="/privacy">{t("footer.privacy")}</Link>
      {" - "}
      <Link to="/terms">{t("privacy.q.terms")}</Link>
      {" - "}
      <Link to="/contact">{t("footer.contact") || "Contact"}</Link>
    </div>

    {/* CC BY 4.0 vaatii tekijän nimen ja linkin lisenssiin — lisenssiehto, ei valinnainen */}
    <p className="footer-attribution" style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
      {t("footer.dataSources") || "Data sources"}:{" "}
      <a
        href="https://en.ilmatieteenlaitos.fi/open-data"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit" }}
      >
        Ilmatieteen laitos
      </a>{" "}
      (
      <a
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit" }}
      >
        CC BY 4.0
      </a>
      ) · NOAA SWPC · OpenStreetMap
    </p>
  </div>
</footer>
    </div>
  );
}
