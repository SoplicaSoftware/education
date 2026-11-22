import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// A relative base keeps the build working under any sub-path,
// e.g. https://<user>.github.io/education/engineering-flashcards/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 },
  server: { host: true, port: 4317 },
  preview: { host: true, port: 4318 },
})
