// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
// Build for the single-file demo (../demo/metis-demo.html). Used only by ../demo/construir.py;
// the normal dev server and `npm run build` keep using vite.config.ts.
// One JS chunk, one CSS file, every asset (fonts, images) inlined as data: URIs, relative base.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: process.env.METIS_DEMO_OUT || 'dist-demo',
    emptyOutDir: true,
    assetsInlineLimit: 100 * 1024 * 1024,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 4096,
    rolldownOptions: { output: { codeSplitting: false } },
  },
})
