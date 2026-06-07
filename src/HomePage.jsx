import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Sightings from "./components/Sightings";
import ReportButton from "./components/ReportButton";
import useTranslation from "./hooks/useTranslation";
import Forecast from "./components/Forecast";
import PlacesSection from "./components/PlacesSection";
import SEO from "./components/SEO";
import { client } from "./lib/contentfulClient"; // 1. Tuodaan Contentful-asiakas (varmista polun .. määrä)

const BASE =
  import.meta.env.VITE_API_BASE ||
  "https://report.masto84.workers.dev";

const NOAA_3_DAY_FORECAST_URL =
  "https://services.swpc.noaa.gov/text/3-day-forecast.txt";

const FREE_FORECAST_CACHE_KEY = "aurora_session_cache:home:forecast:free:v1";
const FORECAST_TTL_MS = 60 * 60 * 1000;

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
    sessionStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {}
}

async function sessionCachedJson(key, ttlMs, fetcher) {
  const cached = readSessionCache(key, ttlMs);
  if (cached) return cached;
  const data = await fetcher();
  writeSessionCache(key, data);
  return data;
}

async function fetchTextSafe(url, label) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} ${res.status}: ${text.slice(0, 120)}`);
  if (!text.trim()) throw new Error(`${label}: empty response`);
  return text;
}

function kpToLevel(kp) {
  if (kp == null) return "low";
  if (kp >= 7) return "veryhigh";
  if (kp >= 5) return "high";
  if (kp >= 4) return "medium";
  return "low";
}

function parseNoaa3DayKp(text) {
  const lines = text.split("\n");
  const startIdx = lines.findIndex((line) =>
    /NOAA Kp index breakdown/i.test(line)
  );
  if (startIdx < 0) return [];

  let headerLine = null;
  for (let i = startIdx + 1; i < Math.min(startIdx + 6, lines.length); i++) {
    if (/[A-Z][a-z]{2}\s+\d{1,2}/.test(lines[i])) {
      headerLine = lines[i];
      break;
    }
  }
  if (!headerLine) return [];

  const dateMatches = [...headerLine.matchAll(/([A-Z][a-z]{2})\s+(\d{1,2})/g)];
  if (dateMatches.length < 3) return [];

  const year = new Date().getUTCFullYear();
  const nowMonth = new Date().getUTCMonth();
  const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

  const dates = dateMatches.slice(0, 3).map((match) => {
    const mo = monthMap[match[1]];
    const d = parseInt(match[2], 10);
    let yr = year;
    if (mo < nowMonth - 6) yr = year + 1;
    return { mo, d, yr };
  });

  const series = [];
  for (const line of lines) {
    const match = line.match(/^\s*(\d{2})-(\d{2})UT\s+([\d.]+)(?:\s*\(?[A-Z]?\)?)?\s+([\d.]+)(?:\s*\(?[A-Z]?\)?)?\s+([\d.]+)/);
    if (!match) continue;
    const startH = parseInt(match[1], 10);
    const vals = [parseFloat(match[3]), parseFloat(match[4]), parseFloat(match[5])];
    for (let c = 0; c < 3; c++) {
      if (Number.isNaN(vals[c])) continue;
      const tsMs = Date.UTC(dates[c].yr, dates[c].mo, dates[c].d, startH, 0, 0);
      series.push({ tsMs, kp: Math.round(vals[c] * 10) / 10 });
    }
  }
  series.sort((a, b) => a.tsMs - b.tsMs);
  return series;
}

async function fetchFreeForecast() {
  return sessionCachedJson(FREE_FORECAST_CACHE_KEY, FORECAST_TTL_MS, async () => {
    const text = await fetchTextSafe(NOAA_3_DAY_FORECAST_URL, "NOAA 3-day forecast");
    const kpSeries = parseNoaa3DayKp(text);
    const now = Date.now();
    const cutoff = now + 72 * 60 * 60 * 1000;
    const slots = kpSeries
      .filter((slot) => slot.tsMs >= now - 3 * 60 * 60 * 1000 && slot.tsMs <= cutoff)
      .map((slot) => ({
        tsUtc: new Date(slot.tsMs).toISOString(),
        kp: slot.kp,
        level: kpToLevel(slot.kp),
      }));
    return { tier: "free", genAt: new Date(now).toISOString(), slots, current: null };
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
      tier: data?.tier || "premium",
      slots: Array.isArray(data?.slots) ? data.slots : [],
      genAt: data?.genAt || null,
      current: data?.current || null,
    };
  });
}

export default function HomePage() {
  const [forecast, setForecast] = useState({ tier: "free", slots: [], genAt: null, current: null });
  // 2. Luodaan tila Contentful-artikkeleille
  const [articles, setArticles] = useState([]);
  const { t, currentLanguage } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    // Ennusteen haku (pysyy ennallaan)
    const loadForecast = async () => {
      try {
        const deviceKey = readDeviceKey();
        const data = deviceKey ? await fetchPremiumForecast(deviceKey) : await fetchFreeForecast();
        if (cancelled) return;
        setForecast({
          tier: data?.tier || "free",
          slots: Array.isArray(data?.slots) ? data.slots : [],
          genAt: data?.genAt || null,
          current: data?.current || null,
        });
      } catch (e) {
        console.error("FORECAST ERROR:", e);
        if (cancelled) return;
        setForecast((prev) => {
          if (prev.slots.length) return prev;
          return { tier: "free", slots: [], genAt: null, current: null };
        });
      }
    };

    // 3. Haetaan 3 uusinta artikkelia Contentfulista
    const loadArticles = () => {
      client.getEntries({
        content_type: 'post',
        limit: 3 // Haetaan tasan 3 kappaletta etusivulle
      })
      .then((response) => {
        if (!cancelled) {
          setArticles(response.items);
        }
      })
      .catch((err) => console.error("Virhe etusivun artikkeleiden haussa:", err));
    };

    loadForecast();
    loadArticles();

    return () => {
      cancelled = true;
    };
  }, []);

  const lang = currentLanguage || "fi";

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
        <section className="block">
          <div className="container">
            <div className="hero-banner">
 <img 
      src="/images/reposet.png" 
      alt="Northern Lights" 
      style={{ width: "100%", height: "auto", borderRadius: "8px", marginBottom: "20px" }} 
    />

            <Hero />
          </div>
        </section>

        {/* FORECAST */}
        <section className="block">
          <div className="container">
            <Forecast
              data={forecast.slots}
              tier={forecast.tier}
              genAt={forecast.genAt}
              current={forecast.current}
            />
          </div>
        </section>

        {/* SIGHTINGS */}
        <section className="container section-block">
          <div className="section-head">
            <div>
              <h2>{t("sightings.title")}</h2>
              <p>{t("sightings.sub")}</p>
            </div>
            <ReportButton />
          </div>
          <Sightings />
        </section>

        {/* LOCATIONS */}
        <section className="block">
          <div className="container">
            <PlacesSection />
          </div>
        </section>

        {/* ARTICLES */}
        <section className="block">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>{t("home.articles.title")}</h2>
                <p>{t("home.articles.sub")}</p>
              </div>
            </div>

            {/* 4. Tulostetaan dynaamiset kortit Contentfulista */}
            <div className="home-articles">
              {articles.map((article) => {
                const { title, excerpt, slug } = article.fields;

                // Kielituki (kuten BlogPost-sivulla)
                const displayTitle = title?.[lang] || title || "";
                const displayExcerpt = excerpt?.[lang] || excerpt || "";

                return (
                  <Link key={article.sys.id} to={`/blog/${slug}`} className="blog-card">
                    {/* GUIDE-tagi poistettu pyynnöstäsi */}
                    <h2>{displayTitle}</h2>
                    <p>{displayExcerpt}</p>
                    <div className="blog-card-read">{t("blog.read")}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© RepoTracker</p>
        <Link to="/privacy">{t("footer.privacy")}</Link>
        {" - "}
        <Link to="/terms">{t("privacy.q.terms")}</Link>
        {" - "}
        <Link to="/contact">{t("footer.contact") || "Contact"}</Link>
      </footer>
    </div>
  );
}