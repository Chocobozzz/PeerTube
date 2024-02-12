import { basename, extname, isAbsolute, join, parse, resolve } from 'path'
import { fileURLToPath } from 'url'

let rootPath: string

export function currentDir (metaUrl: string) {
  return resolve(fileURLToPath(metaUrl), '..')
}

export function root (metaUrl?: string) {
  if (rootPath) return rootPath

  if (!metaUrl) {
    metaUrl = import.meta.url

    const filename = basename(metaUrl) === 'path.js' || basename(metaUrl) === 'path.ts'
    if (!filename) throw new Error('meta url must be specified as this file has been bundled in another one')
  }

  rootPath = currentDir(metaUrl)

  if (basename(rootPath) === 'src' || basename(rootPath) === 'dist') rootPath = resolve(rootPath, '..')
  if ([ 'node-utils', 'peertube-cli', 'peertube-runner' ].includes(basename(rootPath))) rootPath = resolve(rootPath, '..')
  if ([ 'packages', 'apps' ].includes(basename(rootPath))) rootPath = resolve(rootPath, '..')
  if (basename(rootPath) === 'dist') rootPath = resolve(rootPath, '..')

  return rootPath
}

export function buildPath (path: string) {
  if (isAbsolute(path)) return path

  return join(root(), path)
}

export function getLowercaseExtension (filename: string) {
  const ext = extname(filename) || ''

  return ext.toLowerCase()
}

export function buildAbsoluteFixturePath (path: string, customCIPath = false) {
  if (isAbsolute(path)) return path

  if (customCIPath && process.env.GITHUB_WORKSPACE) {
    return join(process.env.GITHUB_WORKSPACE, 'fixtures', path)
  }

  return join(root(), 'packages', 'tests', 'fixtures', path)
}

export function getFilenameFromUrl (url: string) {
  return getFilename(new URL(url).pathname)
}

export function getFilename (path: string) {
  return parse(path).base
}

export function getFilenameWithoutExt (path: string) {
  return parse(path).name
}
