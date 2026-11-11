import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// MonoRail serves the built "ui" folder from monorail-ext://<id>/, so asset
// URLs must be relative (base './'). Its CSP forbids inline scripts, which
// Vite's production build doesn't use.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'ui', emptyOutDir: true },
})
