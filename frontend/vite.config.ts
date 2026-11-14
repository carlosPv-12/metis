// Generated with AI assistance (Claude) — Te Falta Tech, NASA Space Apps 2026
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // `..` lets the app import ../data/*.json and ../backend/triage_tree.json as offline fallbacks
  server: { proxy: { '/api': 'http://localhost:8000' }, fs: { allow: ['..'] } },
  plugins: [react()],
})
