/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Vite plugin that stamps the service worker with a unique cache version
 * derived from the build timestamp. This ensures clients pick up new assets
 * after every deployment without manual version bumping.
 */
function swVersionPlugin(): Plugin {
  return {
    name: 'sw-version-stamp',
    apply: 'build',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist', 'sw.js')
      try {
        let swContent = readFileSync(swPath, 'utf-8')
        const buildVersion = `mortimer-cache-${Date.now()}`
        swContent = swContent.replace(
          /const CACHE_NAME = ['"].*?['"]/,
          `const CACHE_NAME = '${buildVersion}'`
        )
        writeFileSync(swPath, swContent, 'utf-8')
        console.log(`[sw-version] Stamped SW cache: ${buildVersion}`)
      } catch (e) {
        // SW file may not exist if removed — not fatal
        console.warn('[sw-version] Could not stamp sw.js:', (e as Error).message)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/Mortimer/',
  plugins: [react(), swVersionPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split the React runtime into a stable vendor chunk so it stays cached
          // across app-code deployments. Only the React core is forced here — Chart.js
          // is left to Rollup's automatic splitting, which keeps it in its own chunk
          // loaded on demand by the lazy Paydown/Rate views (never at initial paint).
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
