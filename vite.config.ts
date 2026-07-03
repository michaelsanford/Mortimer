/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/**
 * Vite plugin that, after every production build:
 *  1. Replaces the CACHE_NAME placeholder in dist/sw.js with a unique
 *     build-timestamp-derived version string so clients always pick up
 *     new assets without manual version bumping.
 *  2. Reads the Vite manifest (dist/.vite/manifest.json) and injects the
 *     full list of hashed asset file paths into the __VITE_ASSETS__ placeholder
 *     in dist/sw.js, enabling complete pre-caching of all JS/CSS chunks on install.
 */
function swVersionPlugin(): Plugin {
  return {
    name: 'sw-version-stamp',
    apply: 'build',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist', 'sw.js')
      const manifestPath = resolve(__dirname, 'dist', '.vite', 'manifest.json')

      try {
        let swContent = readFileSync(swPath, 'utf-8')

        // 1. Stamp cache version
        const buildVersion = `mortimer-cache-${Date.now()}`
        swContent = swContent.replace(
          /const CACHE_NAME = ['\"].*?['\"]/,
          `const CACHE_NAME = '${buildVersion}'`
        )
        console.log(`[sw-version] Stamped SW cache: ${buildVersion}`)

        // 2. Inject hashed asset paths from Vite manifest
        let viteAssets: string[] = []
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<
            string,
            { file: string; css?: string[] }
          >
          for (const entry of Object.values(manifest)) {
            viteAssets.push(`./${entry.file}`)
            if (entry.css) {
              for (const css of entry.css) {
                viteAssets.push(`./${css}`)
              }
            }
          }
          viteAssets = [...new Set(viteAssets)]
          console.log(`[sw-version] Injecting ${viteAssets.length} hashed assets into SW cache list`)
        } else {
          console.warn('[sw-version] Vite manifest not found — hashed assets will NOT be pre-cached')
        }

        swContent = swContent.replace(
          '__VITE_ASSETS__',
          JSON.stringify(viteAssets)
        )

        writeFileSync(swPath, swContent, 'utf-8')
      } catch (e) {
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
    // Emit the Vite manifest so swVersionPlugin can read hashed asset names
    manifest: true,
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
