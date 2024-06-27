import { defineConfig } from 'vite'
import { resolve } from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import checker from 'vite-plugin-checker'

const __dirname = dirname(fileURLToPath(import.meta.url))

const root = resolve(__dirname, '../../../')

export default defineConfig(() => {
  return {
    base: '/client/standalone/videos/',
    root: resolve(root, 'src', 'standalone', 'videos'),

    resolve: {
      alias: [
        { find: /^video.js$/, replacement: resolve(root, './node_modules/video.js/core.js') },
        { find: /^hls.js$/, replacement: resolve(root, './node_modules/hls.js/dist/hls.light.mjs') },
        { find: '@root-helpers', replacement: resolve(root, './src/root-helpers') }
      ],
    },

    css: {
      preprocessorOptions: {
        scss: {
          includePaths: [resolve(root, './src/sass/include')]
        }
      }
    },

    build: {
      outDir: resolve(root, 'dist', 'standalone', 'videos'),
      emptyOutDir: true,

      target: [ 'firefox78', 'ios12' ],

      rollupOptions: {
        input: {
          embed: resolve(root, 'src', 'standalone', 'videos', 'embed.html'),
          'test-embed': resolve(root, 'src', 'standalone', 'videos', 'test-embed.html')
        },
      },
    },

    plugins: [
      checker({
        typescript: {
          tsconfigPath: resolve(root, 'src', 'standalone', 'videos', 'tsconfig.json')
        }
      }),

      nodePolyfills()
    ]
  }
})
