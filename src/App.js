import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import HomePage from "./HomePage";
import MapPage from "./MapPage";
import BlogPost from "./BlogPost";
import BlogPage from "./pages/BlogPage";
import FaqPage from "./FaqPage";
import PrivacyPage from "./PrivacyPage";
import TermsPage from "./TermsPage";
import PremiumPage from "./PremiumPage";
import PremiumSuccessPage from "./PremiumSuccessPage";
import Contact from "./Contact";
import MidnightSunV2 from "./components/MidnightSunV2";
import PremiumExpiredNotice from "./components/PremiumExpiredNotice";
import CookieBanner from "./components/CookieBanner";
import PlacePage from "./PlacePage";
import Premiummodalmanager from "./components/Premiummodalmanager";
import Aboutpage from "./Aboutpage";
import AlertsPage from "./AlertsPage";
import NotFoundPage from "./NotFoundPage";
import Auroraassistant from "./components/Auroraassistant";


function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
      <Premiummodalmanager />
      {/* Näkyy kerran per istunto kun premium on juuri päättynyt */}
      <PremiumExpiredNotice />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/premium-success" element={<PremiumSuccessPage />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/MidNightSunV2" element={<MidnightSunV2 />} />
          <Route path="/places/:slug" element={<PlacePage />} />
          <Route path="/about" element={<Aboutpage />} />

          {/* AI-avustaja ohjaa tänne kun olosuhteet ovat huonot juuri nyt:
              "[Aseta hälytys](/alerts)". Jos poistat tämän reitin, muista
              poistaa polku myös lib/routes.js:stä ja Dify-agentin ohjeesta. */}
          <Route path="/alerts" element={<AlertsPage />} />

          {/* Varareitti KAIKELLE muulle. Ilman tätä tuntematon osoite
              renderöi tyhjän sivun ilman virheilmoitusta. Pidä viimeisenä. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        {/* Kelluva AI-avustaja. Näkyy kaikilla sivuilla, joten se kuuluu
            Routesin ULKOPUOLELLE mutta Routerin sisälle — komponentti
            käyttää useNavigatea, joka vaatii Router-kontekstin.

            HUOM: tämä importti katosi kertaalleen kun App.js:ää muokattiin
            About-sivua varten, jolloin widget hävisi sivustolta kokonaan
            ilman että mikään antoi virhettä. Jos lisäät tänne reittejä,
            tarkista että tämä rivi on yhä paikallaan. */}
        <Auroraassistant />
      </BrowserRouter>
      <CookieBanner />
    </HelmetProvider>
  );
}

export default App;