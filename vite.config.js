import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le site est servi sous https://<pseudo>.github.io/badge-reminder/
// Modifiez VITE_BASE (ex. "/") si le nom du dépôt change.
export default defineConfig({
  base: process.env.VITE_BASE || '/badge-reminder/',
  plugins: [react()],
  test: { include: ['src/**/*.test.js'] },
});
