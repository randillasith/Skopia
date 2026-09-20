import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// The bundle goes to frontend/dist, and Maven copies it into
// target/classes/static during the build. Nothing generated is written
// into src/, so `mvnw clean` clears it and it is never committed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    host: true,
    // In development the UI runs on Vite for hot reload and calls the
    // Spring Boot API through this proxy, so the browser sees one origin
    // and no CORS configuration is needed on either side.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
