/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// El motor ONNX de la voz neuronal se sirve desde la propia app, en la misma versión que la librería
// (antes venía de un CDN con otra versión y en el iPhone fallaba "Importing a module script failed").
const MOTOR_ONNX = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']
const motorOnnx = {
  name: 'motor-onnx',
  generateBundle(this: { emitFile: (a: { type: 'asset'; fileName: string; source: Uint8Array }) => void }) {
    for (const f of MOTOR_ONNX) {
      this.emitFile({ type: 'asset', fileName: `ort/${f}`, source: readFileSync(`node_modules/onnxruntime-web/dist/${f}`) })
    }
  },
}

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  // Rutas relativas: la app funciona igual en un dominio propio o en una subcarpeta (GitHub Pages).
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    motorOnnx,
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'La Doc',
        short_name: 'La Doc',
        description: 'Estudio de medicina con repaso espaciado, funciona sin internet.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf8fc',
        theme_color: '#7c3aed',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Toda la app queda guardada en el teléfono; sin internet se sirve desde ahí.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // El motor de la voz local viene de estos CDN la primera vez y queda guardado para usarlo sin internet.
        runtimeCaching: [
          {
            // 14 MB: se guarda la primera vez que se usa la voz neuronal, no al instalar.
            urlPattern: ({ url }) => url.pathname.endsWith('/ort/ort-wasm-simd-threaded.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'motor-onnx', cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'motor-voz',
              expiration: { maxEntries: 20 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
