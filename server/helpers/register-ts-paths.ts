import { resolve } from 'path'
import tsConfigPaths = require('tsconfig-paths')

const tsConfig = require('../../tsconfig.json')

function registerTSPaths () {
  // Thanks: https://github.com/dividab/tsconfig-paths/issues/75#issuecomment-458936883
  tsConfigPaths.register({
    baseUrl: resolve(tsConfig.compilerOptions.baseUrl || '', tsConfig.compilerOptions.outDir || ''),
    paths: tsConfig.compilerOptions.paths
  })
}

export {
  registerTSPaths
}
