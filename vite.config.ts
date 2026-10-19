import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // GitHub Pages serves the site from /blueprince-toolkit/. Set BASE_PATH=/ for a custom domain.
  base: process.env.BASE_PATH || '/blueprince-toolkit/',
  plugins: [preact()],
});
