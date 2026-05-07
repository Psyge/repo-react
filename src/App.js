import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import MapPage from "./MapPage";
import BlogPost from "./BlogPost";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;