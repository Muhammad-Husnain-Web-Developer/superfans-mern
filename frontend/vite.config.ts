import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      // Express API (superfans-mern/backend) during development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Media — same URL shape as Laravel (/assets/images/<file>)
      '/assets': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Socket.io (chat real-time) — proxied so the auth cookie (set on this origin
      // via the /api proxy) travels with the WebSocket handshake.
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
