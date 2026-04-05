import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  /** Default `/` — only change if the app is deployed under a subpath (e.g. `/my-app/`). */
  base: '/',
  plugins: [react(), tailwindcss()],
});
