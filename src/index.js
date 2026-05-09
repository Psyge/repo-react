import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import "leaflet/dist/leaflet.css";

import { PremiumProvider } from './context/PremiumContext';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <PremiumProvider>
      <App />
    </PremiumProvider>
  </React.StrictMode>
);

reportWebVitals();