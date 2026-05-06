import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import MapPage from "./MapPage";
import BlogPost1 from "./pages/BlogPost1";
import BlogPost2 from "./pages/BlogPost2";
import BlogPost3 from "./pages/BlogPost3";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/blog/photography" element={<BlogPost1 />} />
        <Route path="/blog/forecast" element={<BlogPost2 />} />
        <Route path="/blog/timing" element={<BlogPost3 />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;