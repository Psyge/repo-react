import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import MapPage from "./MapPage";
import BlogPost from "./BlogPost";
import BlogPage from "./pages/BlogPage";
import FaqPage from './FaqPage';
import PrivacyPage from './PrivacyPage';
import TermsPage from './TermsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;