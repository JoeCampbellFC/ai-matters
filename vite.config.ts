import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const certPath = path.resolve(import.meta.dirname, './certs/localhost-cert.pem')
const keyPath = path.resolve(import.meta.dirname, './certs/localhost-key.pem')
const hasDevCert = existsSync(certPath) && existsSync(keyPath)

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8787'

// The iManage OAuth redirect URI must be HTTPS, even for local development.
// Run `npm run setup:certs` once to generate certs/localhost-{cert,key}.pem,
// after which the dev server serves https://localhost:5173 and proxies
// /api to the backend, keeping the whole app same-origin from the browser's
// perspective. Without a cert, `npm run dev` still works over plain HTTP for
// UI-only work, but the iManage connect flow will not.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    https: hasDevCert
      ? {
          cert: readFileSync(certPath),
          key: readFileSync(keyPath),
        }
      : undefined,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})
