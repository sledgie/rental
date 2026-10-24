import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// In development the browser talks to Vite, and Vite forwards /api calls to the API server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // '@' is only used by the dashboard folder (ported from the reference project).
  resolve: { alias: { '@': fileURLToPath(new URL('./src/dashboard', import.meta.url)), '@lf': fileURLToPath(new URL('./src/landing', import.meta.url)), '@inv': fileURLToPath(new URL('./src/invoices', import.meta.url)) } },
  server: { port: 5173, allowedHosts: ['walrus-central-coral.ngrok-free.app'], proxy: { '/api': 'http://localhost:3001' } },
});
