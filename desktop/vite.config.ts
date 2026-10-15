import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Reuses the extension's pure logic (price parsing, ...) and its bundled Tesseract assets.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  publicDir: resolve(__dirname, '../public'),
  resolve: { alias: { '@': resolve(__dirname, '../src') }, dedupe: ['react', 'react-dom', 'react-i18next', 'i18next'] },
  server: { port: 1420, strictPort: true, fs: { allow: [resolve(__dirname, '..')] } },
  build: { outDir: 'dist', target: 'safari15' }
});
