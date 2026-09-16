import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter, Routes, Route, Link } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { PremiumProvider } from "../context/PremiumContext";
import { setLang } from "../utils/i18n";
import { localizedField } from "../lib/prerenderData";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import SiteIntroduction from "../components/SiteIntroduction";
import AboutPage from "../Aboutpage";
import TermsPage from "../TermsPage";
import PrivacyPage from "../PrivacyPage";
import FaqPage from "../FaqPage";
import Contact from "../Contact";
import PremiumPage from "../PremiumPage";
import AlertsPage from "../AlertsPage";
import NotFoundPage from "../NotFoundPage";
import BlogPage from "../pages/BlogPage";
import BlogPost from "../BlogPost";
import PlacePage from "../PlacePage";

function InteractivePage({ route, posts }) {
  return <div>
    <SEO title={route.title} description={route.desc} canonical={`https://repotracker.fi${route.p}`} noIndex={route.noindex} />
    <Header />
    <main className="container page-main">
      <h1>{route.heading || route.title.split(" | ")[0]}</h1>
      <p>{route.desc}</p>
      <p>Live forecasts, the interactive map and account features load when JavaScript is enabled.</p>
      {route.p === "/" && <>
        <SiteIntroduction />
        <section><h2>Latest articles</h2>{posts.slice(0, 3).map(({ sys, fields }) => <article key={sys.id}>
          <h3><Link to={`/blog/${localizedField(fields.slug, "en-US")}`}>{localizedField(fields.title, "en-US")}</Link></h3>
          <p>{localizedField(fields.excerpt, "en-US")}</p>
        </article>)}</section>
      </>}
    </main>
    <Footer />
  </div>;
}

export function renderPage(route, data) {
  setLang(route.language || "en");
  // Rendering the document lets React 19 hoist metadata into <head>.
  const html = renderToStaticMarkup(
    <html lang={route.language || "en"}><head /><body>
      <div id="root"><HelmetProvider><PremiumProvider><StaticRouter location={route.p}>
        <Routes>
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/blog" element={<BlogPage initialEntries={data.posts} />} />
          <Route path="/blog/:slug" element={<BlogPost initialEntries={data.posts} />} />
          <Route path="/places/:slug" element={<PlacePage initialEntries={data.places} />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<InteractivePage route={route} posts={data.posts} />} />
        </Routes>
      </StaticRouter></PremiumProvider></HelmetProvider></div>
    </body></html>
  );
  return { head: html.match(/<head>([\s\S]*?)<\/head>/)[1], body: html.match(/<body>([\s\S]*?)<\/body>/)[1] };
}
