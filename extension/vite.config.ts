import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'path'

// BACKEND_URL is baked in at build time.
// For production: set BACKEND_URL env var before running `npm run build`
// For local dev: leave unset to use http://localhost:3001
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [preact()],
  define: {
    __BACKEND_URL__: JSON.stringify(BACKEND_URL),
  },
  build: {
    // Build as an IIFE so it can be loaded as a Chrome extension content script
    // (Manifest V3 content scripts cannot use ES module dynamic imports)
    lib: {
      entry: resolve(__dirname, 'src/content/index.tsx'),
      name: 'LiveCheck',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    // Inline all CSS into the JS bundle — we inject it into a Shadow DOM at runtime
    cssCodeSplit: false,
  },
})
