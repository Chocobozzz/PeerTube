import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    build: {
      outDir: resolve(__dirname, 'build'),
      emptyOutDir: true,
      minify: 'esbuild',
      target: [ 'firefox78', 'ios12' ],
      lib: {
        name: 'PeerTubePlayer',
        fileName: () => `player.min.js`,
        formats: [ 'umd' ],
        entry: './player.ts'
      }
    },

    plugins: [
      checker({
        typescript: {
          tsconfigPath: resolve(__dirname, 'tsconfig.json')
        }
      })
    ]
  }
})
