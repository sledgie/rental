import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// apply the saved theme before the first paint (dark is the default)
try {
  const t = localStorage.getItem('rms.theme');
  document.documentElement.dataset.theme = t === 'light' || t === 'blue' ? 'light' : 'dark';
  if (t === 'blue') document.documentElement.dataset.accent = 'blue';
} catch { document.documentElement.dataset.theme = 'dark'; }
import App from './App.jsx';
import AuthGate from './auth/AuthGate';

createRoot(document.getElementById('root')).render(<AuthGate><App /></AuthGate>);
