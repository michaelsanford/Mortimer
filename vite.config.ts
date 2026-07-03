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
})
