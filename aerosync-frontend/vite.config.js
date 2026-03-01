import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

// When running locally you can point the proxy at a tunnel or custom host
// by setting VITE_API_PROXY_TARGET. It defaults to the local backend port.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    strictPort: false,
    port: 5173,
    // front end is often accessed via HTTPS (ngrok/Cloudflare).
    // when running locally you can set VITE_HTTPS=true to serve
    // the dev server over HTTPS so that relative `/api` calls
    // remain HTTPS and are proxied correctly inside Vite.
    https: process.env.VITE_HTTPS === 'true' || false,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'aerosync.live',
      'www.aerosync.live',
      // wildcard entries for ngrok-style domains
      '*.ngrok.io',
      '*.ngrok-free.app',
    ],
    // During development the server will proxy any request starting with
    // /api or /media to the backend.  By default this is localhost:8000, but
    // when you're running the frontend through a public tunnel you can point
    // the proxy at your tunnel domain by setting VITE_API_PROXY_TARGET. This
    // allows the browser to hit the same host it was served from (avoiding
    // CORS problems) while still forwarding to the correct backend.
    proxy: {
      '/api': {
        target: apiProxyTarget,
        rewrite: (path) => path,
        changeOrigin: true,
        secure: false,
      },
      '/media/': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  }
})
