import * as esbuild from 'esbuild'
import { readFileSync } from 'fs'

const packageJSON = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

export const esbuildOptions = {
  entryPoints: [ './src/peertube-runner.ts' ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node16',
  external: [
    './lib-cov/fluent-ffmpeg',
    'pg-hstore'
  ],
  outfile: './dist/peertube-runner.js',
  banner: {
    js: `const require = (await import("node:module")).createRequire(import.meta.url);` +
      `const __filename = (await import("node:url")).fileURLToPath(import.meta.url);` +
      `const __dirname = (await import("node:path")).dirname(__filename);`
  },
  define: {
    'process.env.PACKAGE_VERSION': `'${packageJSON.version}'`
  }
}

await esbuild.build(esbuildOptions)
