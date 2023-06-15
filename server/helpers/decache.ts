// Thanks: https://github.com/dwyl/decache
// We reuse this file to also uncache plugin base path

import { extname } from 'path'

function decachePlugin (libraryPath: string) {
  const moduleName = find(libraryPath)

  if (!moduleName) return

  searchCache(moduleName, function (mod) {
    delete require.cache[mod.id]

    removeCachedPath(mod.path)
  })
}

function decacheModule (name: string) {
  const moduleName = find(name)

  if (!moduleName) return

  searchCache(moduleName, function (mod) {
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

function find (moduleName: string) {
  try {
    return require.resolve(moduleName)
  } catch {
    return ''
  }
}

function searchCache (moduleName: string, callback: (current: NodeModule) => void) {
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
  const pathCache = (module.constructor as any)._pathCache as { [ id: string ]: string[] }

  Object.keys(pathCache).forEach(function (cacheKey) {
    if (cacheKey.includes(pluginPath)) {
      delete pathCache[cacheKey]
    }
  })
}
