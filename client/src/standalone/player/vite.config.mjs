import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'

import { getCSSConfig, getAliasConfig } from '../build-tools/vite-utils.js'

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
        cssFilename: 'peertube-player.css'
      }
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

      nodePolyfills()
    ]
  }
})
