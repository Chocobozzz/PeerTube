// Thanks: https://github.com/dwyl/decache
// We reuse this file to also uncache plugin base path

import { CONFIG } from '@server/initializers/config.js'
import { Module } from 'module'
import { extname, join } from 'path'

export function decachePlugin (require: NodeJS.Require, libraryPath: string) {
  const moduleName = find(require, libraryPath)

  if (!moduleName) return

  searchCache(require, moduleName, function (mod) {
    console.log(mod)

    delete require.cache[mod.id]

    removeCachedPath(mod.path)
    removeCachedPath(join(CONFIG.STORAGE.PLUGINS_DIR, 'node_modules'))
  })
}

export function decacheModule (require: NodeJS.Require, name: string) {
  const moduleName = find(require, name)

  if (!moduleName) return

  searchCache(require, moduleName, function (mod) {
    delete require.cache[mod.id]

    removeCachedPath(mod.path)
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function find (require: NodeJS.Require, moduleName: string) {
  try {
    return require.resolve(moduleName)
  } catch {
    return ''
  }
}

function searchCache (require: NodeJS.Require, moduleName: string, callback: (current: NodeJS.Module) => void) {
  const resolvedModule = require.resolve(moduleName)
  let mod: NodeJS.Module
  const visited = {}

  if (resolvedModule && ((mod = require.cache[resolvedModule]) !== undefined)) {
    // Recursively go over the results
    ;(function run (current) {
      visited[current.id] = true

      current.children.forEach(function (child) {
        if (extname(child.filename) !== '.node' && !visited[child.id]) {
          run(child)
        }
      })

      // Call the specified callback providing the
      // found module
      callback(current)
    })(mod)
  }
}

function removeCachedPath (pluginPath: string) {
  const pathCache = (Module as any)._pathCache as { [id: string]: string[] }

  Object.keys(pathCache).forEach(function (cacheKey) {
    if (cacheKey.includes(pluginPath)) {
      delete pathCache[cacheKey]
    }
  })
}
