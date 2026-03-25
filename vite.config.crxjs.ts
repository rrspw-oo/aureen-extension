import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest: manifest as any
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174
    }
  }
});
