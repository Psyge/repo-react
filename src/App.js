import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./HomePage";
import MapPage from "./MapPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;