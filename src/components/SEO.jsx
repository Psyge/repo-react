import { Helmet } from "react-helmet-async";

export default function SEO({
  title,
  description,
  keywords,
  image = "https://repotracker.fi/images/reposet.png",
  canonical,
}) {
  return (
    <Helmet>
      {/* Basic SEO */}
      <title>{title}</title>

      <meta
        name="description"
        content={description}
      />

      <meta
        name="keywords"
        content={keywords}
      />

      <meta
        name="robots"
        content="index,follow"
      />

      {canonical && (
        <link
          rel="canonical"
          href={canonical}
        />
      )}

      {/* Open Graph */}
      <meta
        property="og:title"
        content={title}
      />

      <meta
        property="og:description"
        content={description}
      />

      <meta
        property="og:image"
        content={image}
      />

      <meta
        property="og:url"
        content={canonical}
      />

      <meta
        property="og:type"
        content="website"
      />

      <meta
        property="og:site_name"
        content="RepoTracker"
      />

      <meta
        property="og:locale"
        content="en_US"
      />

      {/* Twitter / X */}
      <meta
        name="twitter:card"
        content="summary_large_image"
      />

      <meta
        name="twitter:title"
        content={title}
      />

      <meta
        name="twitter:description"
        content={description}
      />

      <meta
        name="twitter:image"
        content={image}
      />
    </Helmet>
  );
}