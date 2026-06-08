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
import CookieBanner from "./components/CookieBanner";
import PlacePage from "./PlacePage";

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
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
        </Routes>

        
      </BrowserRouter>
      <CookieBanner />
    </HelmetProvider>
  );
}

export default App;