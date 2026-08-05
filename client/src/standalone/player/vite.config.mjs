import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

import { getAliasConfig, getCSSConfig } from '../build-tools/vite-utils.js'

// See https://github.com/davidmyersdev/vite-plugin-node-polyfills/issues/81
// Remove when upstream bug is fixed
const nodePolyfillsFix = (options) => {
  const origPlugin = nodePolyfills(options)
  return {
    ...origPlugin,
    resolveId(source, importer, opts) {
      const m = /^vite-plugin-node-polyfills\/shims\/(buffer|global|process)$/.exec(source)
      if (m) {
        return `node_modules/vite-plugin-node-polyfills/shims/${m[1]}/dist/index.cjs`
      } else {
        if (typeof origPlugin.resolveId === 'function') {
          return origPlugin.resolveId.call(this, source, importer, opts)
        }
      }
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../../')

export default defineConfig(() => {
  return {
    build: {
      outDir: resolve(__dirname, 'build'),
      emptyOutDir: false,
      minify: false,
      lib: {
        formats: [ 'es' ],
        entry: resolve(__dirname, './src/index.ts'),
        name: 'PeerTubePlayer',
        fileName: 'peertube-player',
        cssFileName: 'peertube-player'
      }
    },

    devtools: {
      enabled: process.env.DEVTOOLS === 'true'
    },

    css: getCSSConfig(root),

    resolve: {
      alias: getAliasConfig(root),

      conditions: [
        'p2pml:core-as-bundle', 'defaultClientConditions'
      ]
    },

    plugins: [
      checker({
        typescript: {
          tsconfigPath: resolve(__dirname, 'tsconfig.json')
        }
      }),

      nodePolyfillsFix()
    ]
  }
})
