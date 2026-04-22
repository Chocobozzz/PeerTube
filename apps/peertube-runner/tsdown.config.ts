import { defineConfig } from 'tsdown'
import { readFileSync } from 'fs'

const packageJSON = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig({
  entry: [ './src/peertube-runner.ts' ],
  shims: true,

  // Use source files for internal PeerTube dependencies
  inputOptions: {
    resolve: {
      conditionNames: [ 'peertube:tsx', 'import', 'node', 'default' ]
    }
  },

  deps: {
    neverBundle: [
      './lib-cov/fluent-ffmpeg',
      'pg-hstore'
    ]
  },

  define: {
    'process.env.PACKAGE_VERSION': `'${packageJSON.version}'`
  }
})
