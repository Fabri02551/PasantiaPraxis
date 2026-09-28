import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Proxy del server de desarrollo, para que "npm run dev" se comporte
  // igual que el contenedor: el front pide rutas relativas ("/api/...")
  // y este proxy las manda a la API local, sin CORS y sin tocar el
  // codigo. En Docker el mismo trabajo lo hace nginx (ver nginx.conf).
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
