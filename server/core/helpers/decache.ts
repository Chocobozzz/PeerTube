// Thanks: https://github.com/dwyl/decache
// We reuse this file to also uncache plugin base path

import { Module } from 'module'
import { extname } from 'path'

function decachePlugin (require: NodeRequire, libraryPath: string) {
  const moduleName = find(require, libraryPath)

  if (!moduleName) return

  searchCache(require, moduleName, function (mod) {
    delete require.cache[mod.id]

    removeCachedPath(mod.path)
  })
}

function decacheModule (require: NodeRequire, name: string) {
  const moduleName = find(require, name)

  if (!moduleName) return

  searchCache(require, moduleName, function (mod) {
    delete require.cache[mod.id]

    removeCachedPath(mod.path)
  })
}

// ---------------------------------------------------------------------------

export {
  decacheModule,
  decachePlugin
}

// ---------------------------------------------------------------------------

function find (require: NodeRequire, moduleName: string) {
  try {
    return require.resolve(moduleName)
  } catch {
    return ''
  }
}

function searchCache (require: NodeRequire, moduleName: string, callback: (current: NodeModule) => void) {
  const resolvedModule = require.resolve(moduleName)
  let mod: NodeModule
  const visited = {}

  if (resolvedModule && ((mod = require.cache[resolvedModule]) !== undefined)) {
    // Recursively go over the results
    (function run (current) {
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
};

function removeCachedPath (pluginPath: string) {
  const pathCache = (Module as any)._pathCache as { [ id: string ]: string[] }

  Object.keys(pathCache).forEach(function (cacheKey) {
    if (cacheKey.includes(pluginPath)) {
      delete pathCache[cacheKey]
    }
  })
}
