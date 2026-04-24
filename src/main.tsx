import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler for debugging white screens
window.onerror = (message, source, lineno, colno, error) => {
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `
      <div style="padding: 20px; color: black; font-family: sans-serif; background: #fff; min-height: 100vh;">
        <h1 style="font-size: 20px; font-weight: 800;">Startup Error detected</h1>
        <p style="opacity: 0.6; font-size: 14px;">The application failed to initialize. This is often due to missing environment variables or a configuration error.</p>
        <pre style="background: #f0f0f0; padding: 10px; border-radius: 8px; font-size: 11px; overflow-x: auto;">${message}\n${error?.stack || ''}</pre>
        <button onclick="window.location.reload()" style="background: black; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 10px;">Retry</button>
      </div>
    `;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
