// ============================================================
// OPSYN MAIN.TSX — React application entry point
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/design-tokens.css'; /* Stage 1: must be first — all tokens defined here */
import './assets/brand.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
