import { basename, extname, isAbsolute, join, resolve } from 'path'

let rootPath: string

function root () {
  if (rootPath) return rootPath

  rootPath = __dirname

  if (basename(rootPath) === 'core-utils') rootPath = resolve(rootPath, '..')
  if (basename(rootPath) === 'shared') rootPath = resolve(rootPath, '..')
  if (basename(rootPath) === 'server') rootPath = resolve(rootPath, '..')
  if (basename(rootPath) === 'dist') rootPath = resolve(rootPath, '..')

  return rootPath
}

function buildPath (path: string) {
  if (isAbsolute(path)) return path

  return join(root(), path)
}

function getLowercaseExtension (filename: string) {
  const ext = extname(filename) || ''

  return ext.toLowerCase()
}

export {
  root,
  buildPath,
  getLowercaseExtension
}
