import { Helmet } from "react-helmet-async";
import useTranslation from "../hooks/useTranslation";

const SITE_NAME = "RepoTracker";
/* reposet.png ei ole palvelimella — se palautti HTML-sivun eikä kuvaa,
   joten jakojen esikatselut jäivät ilman kuvaa. hero-bg.jpg on oma
   revontulikuva ja toimii. Pidä tämä samana kuin middleware.js:n
   DEFAULT_IMAGE, muuten robotti ja selain näkevät eri kuvan. */
const DEFAULT_IMAGE = "https://repotracker.fi/images/og-default.jpg";

export default function SEO({
  title = "RepoTracker | Revontuliennuste ja avaruussää",
  description = "Seuraa revontulia, avaruussäätä, pilvisyyttä ja revontuliennusteita reaaliajassa Suomessa.",
  keywords,
  image = DEFAULT_IMAGE,
  canonical,
  locale,
  language,
  type = "website",
  noIndex = false,
  schema,
  alternates = [],
}) {
  const { currentLanguage } = useTranslation();
  const pageLanguage = language || currentLanguage;
  const pageLocale = locale || (pageLanguage === "fi" ? "fi_FI" : "en_US");
  return (
    <Helmet>
      {/* Sivun kieli */}
      <html lang={pageLanguage} />

      {/* Basic SEO */}
      <title>{title}</title>

      <meta name="description" content={description} />

      {keywords && <meta name="keywords" content={keywords} />}

      <meta
        name="robots"
        content={noIndex ? "noindex, nofollow" : "index, follow"}
      />

      {/* HUOM: tässä oli pelkkä {canonical} aaltosulkeissa ilman tagia.
          Se ei ole JSX vaan objektiliteraali { canonical: canonical },
          jonka React yritti renderöidä lapsena — siitä tuli virhe
          "Objects are not valid as a React child (found: object with
          keys {canonical})" ja koko sivu jäi lataamatta. */}
      {canonical && <link rel="canonical" href={canonical} />}
      {alternates.map(({ language: lang, href }) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={href} />
      ))}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={title} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={pageLocale} />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={title} />

      {/* Schema.org JSON-LD */}
      {schema && (
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      )}
    </Helmet>
  );
}
