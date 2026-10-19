import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// apply the saved theme before the first paint (dark is the default)
try { document.documentElement.dataset.theme = localStorage.getItem('rms.theme') === 'light' ? 'light' : 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
