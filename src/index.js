import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import "leaflet/dist/leaflet.css";

import { PremiumProvider } from './context/PremiumContext';

const root = ReactDOM.createRoot(document.getElementById('root'));

// The initial HTML contains real content. createRoot intentionally replaces
// the static view; React then owns route metadata and interactive features.
document.querySelectorAll('[data-prerender-seo]').forEach(node => node.remove());

root.render(
  <React.StrictMode>
    <PremiumProvider>
      <App />
    </PremiumProvider>
  </React.StrictMode>
);

reportWebVitals();
