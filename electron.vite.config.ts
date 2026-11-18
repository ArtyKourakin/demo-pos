import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

/**
 * Content-Security-Policy injected into index.html.
 * Production: nothing may load from anywhere except the app bundle itself.
 * Development: additionally allows the local Vite dev server (localhost only) for hot reload.
 */
const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' ws://localhost:* http://localhost:*",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'demo-pos-csp',
    transformIndexHtml(html, ctx) {
      return html.replace('__CSP__', ctx.server ? DEV_CSP : PROD_CSP)
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react(), tailwindcss(), cspPlugin()],
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: {
      minify: true,
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') }
    }
  }
})
