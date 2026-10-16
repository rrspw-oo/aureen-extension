import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { execSync } from 'child_process';
import pkg from './package.json' with { type: 'json' };

function buildStamp(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
    const dirty = execSync('git status --porcelain', { cwd: __dirname }).toString().trim() ? '+' : '';
    return `${pkg.version} (${sha}${dirty})`;
  } catch {
    return pkg.version;
  }
}

// Reuses the extension's pure logic (price parsing, ...) and its bundled Tesseract assets.
export default defineConfig({
  plugins: [react()],
  define: { __AUREEN_BUILD__: JSON.stringify(buildStamp()) },
  clearScreen: false,
  publicDir: resolve(__dirname, '../public'),
  resolve: { alias: { '@': resolve(__dirname, '../src') }, dedupe: ['react', 'react-dom', 'react-i18next', 'i18next'] },
  server: { port: 1420, strictPort: true, fs: { allow: [resolve(__dirname, '..')] } },
  build: { outDir: 'dist', target: 'safari15' }
});
