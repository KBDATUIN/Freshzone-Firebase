import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error catcher for debugging local issues
window.onerror = function(msg, url, line, col, error) {
  document.body.innerHTML = `
    <div style="background: #900; color: white; padding: 20px; font-family: monospace;">
      <h3>CRITICAL RUNTIME ERROR</h3>
      <p>${msg}</p>
      <small>${url}:${line}:${col}</small>
    </div>
  `;
  return false;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
