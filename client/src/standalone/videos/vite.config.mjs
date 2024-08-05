import { defineConfig } from 'vite'
import { resolve } from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import checker from 'vite-plugin-checker'

const __dirname = dirname(fileURLToPath(import.meta.url))

const root = resolve(__dirname, '../../../')

export default defineConfig(({ mode }) => {
  return {
    base:  mode === 'development'
      ? ''
      : '/client/standalone/videos/',

    root: resolve(root, 'src', 'standalone', 'videos'),

    server: {
      proxy: {
        '^/(videos|video-playlists)/(test-)?embed/[^\/\.]+$': {
          target: 'http://localhost:5173',
          rewrite: (path) => {
            return path.replace('/videos/embed/', 'embed.html?videoId=')
              .replace('/videos/test-embed/', 'test-embed.html?')
              .replace('/video-playlists/embed/', 'embed.html?videoPlaylistId=')
              .replace('/video-playlists/test-embed/', 'test-embed.html?videoPlaylistId=')
          }
        },
        '^/(videos|video-playlists)/(test-)?embed/.*': {
          target: 'http://localhost:5173',
          rewrite: (path) => {
            return path.replace(/\/(videos|video-playlists)\/(test-)?embed\//, '')
          }
        },
        '^/lazy-static': {
          target: 'http://localhost:9000'
        }
      }
    },

    resolve: {
      alias: [
        { find: /^video.js$/, replacement: resolve(root, './node_modules/video.js/core.js') },
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
      sourcemap: mode === 'development',

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
