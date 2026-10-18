import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  // Relative asset paths, so the build works from any folder (e.g. GitHub Pages under /blueprince-toolkit/).
  base: './',
  plugins: [preact()],
});
