import React from 'react';
import ReactDOM from 'react-dom/client';
import '../scss/main.scss'; // Global SASS styles
// import './index.css'; // Optionally keep if needed
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
